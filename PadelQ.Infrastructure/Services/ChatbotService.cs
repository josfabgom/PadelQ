using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using PadelQ.Application.Common.Interfaces;
using PadelQ.Domain.Entities;
using PadelQ.Infrastructure.Persistence;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;

namespace PadelQ.Infrastructure.Services
{
    public class ChatbotService : IChatbotService
    {
        private readonly ApplicationDbContext _context;
        private readonly IBookingService _bookingService;
        private readonly IConfiguration _configuration;
        private readonly HttpClient _httpClient;

        public ChatbotService(
            ApplicationDbContext context,
            IBookingService bookingService,
            IConfiguration configuration)
        {
            _context = context;
            _bookingService = bookingService;
            _configuration = configuration;
            _httpClient = new HttpClient();
        }

        private async Task<string> GetSetting(string key, string defaultValue)
        {
            var setting = await _context.SystemSettings.FindAsync(key);
            return setting?.Value ?? defaultValue;
        }

        private async Task<int> GetIntSetting(string key, int defaultValue)
        {
            var val = await GetSetting(key, defaultValue.ToString());
            return int.TryParse(val, out var res) ? res : defaultValue;
        }

        public async Task<ChatbotResponseDto> ProcessChatMessageAsync(string userId, string message, List<ChatMessageDto> history)
        {
            try
            {
                var apiKey = _configuration["Gemini:ApiKey"] ?? Environment.GetEnvironmentVariable("GEMINI_API_KEY");
                if (string.IsNullOrEmpty(apiKey) || apiKey == "YOUR_GEMINI_API_KEY" || apiKey == "your_gemini_api_key_here")
                {
                    return new ChatbotResponseDto
                    {
                        Reply = "⚠️ **Asistente de IA Desactivado**\n\nEl administrador del club aún no ha configurado la API Key de Gemini (`GEMINI_API_KEY`). Por favor, configúrala en las variables de entorno o en el archivo `appsettings.json` para habilitar el asistente de reservas.",
                        Action = "none",
                        Success = false
                    };
                }

                // 1. Obtener contexto del club
                var openHour = await GetIntSetting("OpenHour", 8);
                var closeHour = await GetIntSetting("CloseHour", 23);
                var courts = await _context.Courts.Where(c => c.IsActive).ToListAsync();

                // Obtener reservas activas para los próximos 7 días
                var nowLocal = GetArgentinaTime();
                var startRange = nowLocal.Date;
                var endRange = startRange.AddDays(7);

                var bookings = await _context.Bookings
                    .Include(b => b.Court)
                    .Where(b => b.StartTime >= startRange && b.StartTime <= endRange && b.Status != BookingStatus.Cancelled)
                    .OrderBy(b => b.StartTime)
                    .ToListAsync();

                var schedules = await _context.ActivitySchedules
                    .Include(s => s.Court)
                    .ToListAsync();

                // 2. Formatear datos de contexto en texto legible por la IA
                var courtsText = string.Join("\n", courts.Select(c => $"- Cancha ID: {c.Id}, Nombre: {c.Name}, Precio por hora: ${c.PricePerHour:F2}"));

                var bookingsText = bookings.Count == 0 
                    ? "No hay reservas registradas para los próximos 7 días." 
                    : string.Join("\n", bookings.Select(b => $"- Cancha ID: {b.CourtId} ({b.Court?.Name}), Inicio: {b.StartTime:yyyy-MM-dd HH:mm}, Fin: {b.EndTime:yyyy-MM-dd HH:mm}"));

                var schedulesText = schedules.Count == 0
                    ? "No hay actividades/clases semanales bloqueando canchas."
                    : string.Join("\n", schedules.Select(s => $"- Cancha ID: {s.CourtId} ({s.Court?.Name}), Día: {s.DayOfWeek}, Horario: {s.StartTime:hh\\:mm} a {s.EndTime:hh\\:mm}"));

                // 3. Crear el System Prompt
                var systemInstruction = $@"Eres el Asistente de IA de Black Club de Pádel, un club premium de pádel.
Tu objetivo es responder de forma muy amigable, directa y deportiva a las consultas de los clientes sobre la disponibilidad de canchas y permitirles alquilar/reservar en lenguaje natural.

Fecha y hora actual: {nowLocal:dddd dd/MM/yyyy HH:mm} (Hora local de Argentina/Uruguay).

--- REGLAS DEL CLUB ---
- El club abre a las {openHour}:00 hs y cierra a las {closeHour}:00 hs. No se permiten reservas fuera de este rango.
- Los turnos pueden ser de 60, 90 o 120 minutos.
- Si el usuario te pregunta por disponibilidad, analiza detenidamente las reservas actuales y actividades fijas para responder con precisión qué horarios están libres.

--- CANCHAS ACTIVAS ---
{courtsText}

--- RESERVAS EXISTENTES (Próximos 7 días) ---
{bookingsText}

--- ACTIVIDADES FIJAS (Bloquean canchas semanalmente) ---
{schedulesText}

--- INSTRUCCIONES DE RESPUESTA ---
Debes responder SIEMPRE con un objeto JSON válido con los siguientes campos y nada más. No incluyas explicaciones fuera del JSON. El JSON debe cumplir con este esquema:
{{
  ""reply"": ""Respuesta amigable para el cliente en formato Markdown. Si vas a confirmar una reserva, indícale al usuario que estás procesando la reserva."",
  ""action"": ""none"" o ""create_booking"",
  ""courtId"": 1, // (int, solo si action es 'create_booking')
  ""startTime"": ""2026-05-21T18:00:00"", // (string en formato ISO 8601 local, solo si action es 'create_booking')
  ""durationMinutes"": 90 // (int, 60, 90 o 120, solo si action es 'create_booking')
}}

Ejemplo si el cliente dice '¿Qué hay libre mañana a la tarde?':
{{
  ""reply"": ""Hola! Mañana por la tarde (21 de mayo) tenemos disponibles los siguientes turnos:\n- **Cancha Cristal:** de 14:00 a 16:30 y de 19:30 a 22:00.\n- **Cancha Blindex:** de 15:00 a 18:00.\n\n¿Te gustaría que te reserve alguno?"",
  ""action"": ""none"",
  ""courtId"": null,
  ""startTime"": null,
  ""durationMinutes"": null
}}

Ejemplo si el cliente dice 'Reservame la cancha 1 para mañana a las 19 hs por 90 minutos':
{{
  ""reply"": ""¡Excelente elección! Estoy procesando tu reserva para la Cancha Cristal mañana a las 19:00 hs por 90 minutos..."",
  ""action"": ""create_booking"",
  ""courtId"": 1,
  ""startTime"": ""2026-05-21T19:00:00"",
  ""durationMinutes"": 90
}}";

                // 4. Preparar la llamada a Gemini
                var geminiUrl = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={apiKey}";

                // Construir el historial para Gemini
                var contentsList = new List<object>();

                // Insertar System Instruction como primer mensaje del usuario o instrucción del sistema
                // En Gemini 1.5 /generateContent, se puede pasar systemInstruction a nivel raíz o como parte del prompt.
                // Para simplificar la API REST, lo incluimos al inicio de la conversación o como un campo de configuración.
                // Aquí construimos el formato de contenidos compatible con la API de Gemini:
                var systemPart = new { text = systemInstruction };
                contentsList.Add(new { role = "user", parts = new[] { systemPart } });
                contentsList.Add(new { role = "model", parts = new[] { new { text = "Entendido. Asistiré al cliente como Asistente Virtual de Black Club." } } });

                // Agregar historial previo
                foreach (var h in history.TakeLast(10)) // Tomar las últimas 10 interacciones para no saturar
                {
                    contentsList.Add(new
                    {
                        role = h.Role == "model" ? "model" : "user",
                        parts = new[] { new { text = h.Text } }
                    });
                }

                // Agregar el mensaje actual del usuario
                contentsList.Add(new
                {
                    role = "user",
                    parts = new[] { new { text = message } }
                });

                var requestBody = new
                {
                    contents = contentsList,
                    generationConfig = new
                    {
                        responseMimeType = "application/json",
                        temperature = 0.2
                    }
                };

                // 5. Enviar POST a Gemini
                var response = await _httpClient.PostAsJsonAsync(geminiUrl, requestBody);
                if (!response.IsSuccessStatusCode)
                {
                    var errorDetails = await response.Content.ReadAsStringAsync();
                    return new ChatbotResponseDto
                    {
                        Reply = $"⚠️ Error al comunicarse con el servicio de IA de Google. Estado: {response.StatusCode}\n\nDetalles: {errorDetails}",
                        Action = "none",
                        Success = false
                    };
                }

                var geminiResponse = await response.Content.ReadFromJsonAsync<GeminiResponse>();
                var jsonText = geminiResponse?.Candidates?.FirstOrDefault()?.Content?.Parts?.FirstOrDefault()?.Text;

                if (string.IsNullOrEmpty(jsonText))
                {
                    return new ChatbotResponseDto
                    {
                        Reply = "Lo siento, la IA no pudo procesar la respuesta adecuadamente.",
                        Action = "none",
                        Success = false
                    };
                }

                // 6. Parsear la respuesta estructurada de la IA
                var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                var parsedResponse = JsonSerializer.Deserialize<ChatbotResponseDto>(jsonText, options);

                if (parsedResponse == null)
                {
                    return new ChatbotResponseDto
                    {
                        Reply = "Error al interpretar la respuesta estructurada de la IA.",
                        Action = "none",
                        Success = false
                    };
                }

                // 7. Ejecutar acción de reserva si corresponde
                if (parsedResponse.Action == "create_booking" && parsedResponse.CourtId.HasValue && parsedResponse.StartTime.HasValue && parsedResponse.DurationMinutes.HasValue)
                {
                    var (bookingSuccess, bookingMessage, bookingId) = await _bookingService.CreateBooking(
                        userId,
                        parsedResponse.CourtId.Value,
                        parsedResponse.StartTime.Value,
                        parsedResponse.DurationMinutes.Value
                    );

                    if (bookingSuccess)
                    {
                        parsedResponse.Reply = $"🎾 **¡Reserva Confirmada!**\n\n{parsedResponse.Reply}\n\n✔️ **Detalles:**\n- **Código:** `{bookingId}`\n- **Resultado:** {bookingMessage}";
                    }
                    else
                    {
                        parsedResponse.Reply = $"❌ **No se pudo completar la reserva:** {bookingMessage}\n\n¿Deseas buscar otro horario?";
                        parsedResponse.Action = "none";
                    }
                }

                return parsedResponse;
            }
            catch (Exception ex)
            {
                return new ChatbotResponseDto
                {
                    Reply = $"⚠️ Ocurrió un error inesperado al procesar tu solicitud: {ex.Message}",
                    Action = "none",
                    Success = false
                };
            }
        }

        public async Task<ChatbotResponseDto> ProcessPublicChatMessageAsync(string message, List<ChatMessageDto> history)
        {
            try
            {
                var apiKey = _configuration["Gemini:ApiKey"] ?? Environment.GetEnvironmentVariable("GEMINI_API_KEY");
                if (string.IsNullOrEmpty(apiKey) || apiKey == "YOUR_GEMINI_API_KEY" || apiKey == "your_gemini_api_key_here")
                {
                    return new ChatbotResponseDto
                    {
                        Reply = "⚠️ **Asistente de IA Desactivado**\n\nEl administrador del club aún no ha configurado la API Key de Gemini. Por favor, configúrala para habilitar el asistente de reservas.",
                        Action = "none",
                        Success = false
                    };
                }

                // 1. Obtener contexto del club
                var openHour = await GetIntSetting("OpenHour", 8);
                var closeHour = await GetIntSetting("CloseHour", 23);
                var courts = await _context.Courts.Where(c => c.IsActive).ToListAsync();

                // Obtener reservas de los próximos 7 días
                var nowLocal = GetArgentinaTime();
                var startRange = nowLocal.Date;
                var endRange = startRange.AddDays(7);

                var bookings = await _context.Bookings
                    .Include(b => b.Court)
                    .Where(b => b.StartTime >= startRange && b.StartTime <= endRange && b.Status != BookingStatus.Cancelled)
                    .OrderBy(b => b.StartTime)
                    .ToListAsync();

                var schedules = await _context.ActivitySchedules
                    .Include(s => s.Court)
                    .ToListAsync();

                var courtsText = string.Join("\n", courts.Select(c => $"- Cancha ID: {c.Id}, Nombre: {c.Name}, Precio por hora: ${c.PricePerHour:F2}"));

                var bookingsText = bookings.Count == 0 
                    ? "No hay reservas registradas para los próximos 7 días." 
                    : string.Join("\n", bookings.Select(b => $"- Cancha ID: {b.CourtId} ({b.Court?.Name}), Inicio: {b.StartTime:yyyy-MM-dd HH:mm}, Fin: {b.EndTime:yyyy-MM-dd HH:mm}"));

                var schedulesText = schedules.Count == 0
                    ? "No hay actividades/clases semanales bloqueando canchas."
                    : string.Join("\n", schedules.Select(s => $"- Cancha ID: {s.CourtId} ({s.Court?.Name}), Día: {s.DayOfWeek}, Horario: {s.StartTime:hh\\:mm} a {s.EndTime:hh\\:mm}"));

                // 2. Crear el System Prompt para Público
                var systemInstruction = $@"Eres el Asistente de IA de Black Club de Pádel, un club premium de pádel.
Este es el CHATBOT WEB PÚBLICO del club para clientes y visitantes no logueados. Tu objetivo es responder amigablemente a las consultas sobre disponibilidad de canchas y permitirles alquilar en lenguaje natural.

Fecha y hora actual: {nowLocal:dddd dd/MM/yyyy HH:mm} (Hora local).

--- REGLAS DEL CLUB ---
- El club abre a las {openHour}:00 hs y cierra a las {closeHour}:00 hs. No se permiten reservas fuera de este rango.
- Los turnos pueden ser de 60, 90 o 120 minutos.
- Si el usuario te pregunta por disponibilidad, analiza detenidamente las reservas actuales y actividades fijas para responder con precisión qué horarios están libres.

--- CANCHAS ACTIVAS ---
{courtsText}

--- RESERVAS EXISTENTES (Próximos 7 días) ---
{bookingsText}

--- ACTIVIDADES FIJAS (Bloquean canchas semanalmente) ---
{schedulesText}

--- REGLAS OBLIGATORIAS DE RESERVA GUEST/INVITADO ---
Si el usuario manifiesta que quiere realizar una reserva (ej: 'quiero reservar mañana a las 18:00'), debes interactuar con él en lenguaje natural para pedirle OBLIGATORIAMENTE sus datos de contacto. No dejes de pedirlos:
1. DNI
2. Nombre y Apellidos completo
3. Teléfono de contacto
4. Email
NO realices la reserva (mantén action = 'none') hasta que el usuario te proporcione TODOS estos 4 datos de contacto y confirme el horario.
Cuando el usuario te haya dado todos los 4 datos y esté confirmado, establece action = 'create_booking' y rellena todos los campos del JSON incluyendo guestDni, guestName, guestPhone y guestEmail.

--- INSTRUCCIONES DE RESPUESTA ---
Debes responder SIEMPRE con un objeto JSON válido con los siguientes campos y nada más:
{{
  ""reply"": ""Respuesta amigable para el cliente en formato Markdown."",
  ""action"": ""none"" o ""create_booking"",
  ""courtId"": 1, // (int, solo si action es 'create_booking')
  ""startTime"": ""2026-05-21T18:00:00"", // (string en formato ISO 8601 local, solo si action es 'create_booking')
  ""durationMinutes"": 90, // (int, solo si action es 'create_booking')
  ""guestDni"": ""12345678"", // (string, solo si action es 'create_booking')
  ""guestName"": ""Juan Pérez"", // (string, solo si action es 'create_booking')
  ""guestPhone"": ""1122334455"", // (string, solo si action es 'create_booking')
  ""guestEmail"": ""juan@email.com"" // (string, solo si action es 'create_booking')
}}";

                var geminiUrl = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={apiKey}";
                var contentsList = new List<object>();

                var systemPart = new { text = systemInstruction };
                contentsList.Add(new { role = "user", parts = new[] { systemPart } });
                contentsList.Add(new { role = "model", parts = new[] { new { text = "Entendido. Asistiré a los visitantes públicos como Asistente Virtual de Black Club." } } });

                foreach (var h in history.TakeLast(10))
                {
                    contentsList.Add(new
                    {
                        role = h.Role == "model" ? "model" : "user",
                        parts = new[] { new { text = h.Text } }
                    });
                }

                contentsList.Add(new
                {
                    role = "user",
                    parts = new[] { new { text = message } }
                });

                var requestBody = new
                {
                    contents = contentsList,
                    generationConfig = new
                    {
                        responseMimeType = "application/json",
                        temperature = 0.2
                    }
                };

                var response = await _httpClient.PostAsJsonAsync(geminiUrl, requestBody);
                if (!response.IsSuccessStatusCode)
                {
                    var errorDetails = await response.Content.ReadAsStringAsync();
                    return new ChatbotResponseDto
                    {
                        Reply = $"⚠️ Error al comunicarse con el servicio de IA. Estado: {response.StatusCode}\n\nDetalles: {errorDetails}",
                        Action = "none",
                        Success = false
                    };
                }

                var geminiResponse = await response.Content.ReadFromJsonAsync<GeminiResponse>();
                var jsonText = geminiResponse?.Candidates?.FirstOrDefault()?.Content?.Parts?.FirstOrDefault()?.Text;

                if (string.IsNullOrEmpty(jsonText))
                {
                    return new ChatbotResponseDto
                    {
                        Reply = "Lo siento, la IA no pudo procesar la respuesta adecuadamente.",
                        Action = "none",
                        Success = false
                    };
                }

                var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                var parsedResponse = JsonSerializer.Deserialize<ChatbotResponseDto>(jsonText, options);

                if (parsedResponse == null)
                {
                    return new ChatbotResponseDto
                    {
                        Reply = "Error al interpretar la respuesta estructurada de la IA.",
                        Action = "none",
                        Success = false
                    };
                }

                // Ejecutar reserva pública de invitado si corresponde
                if (parsedResponse.Action == "create_booking" && parsedResponse.CourtId.HasValue && parsedResponse.StartTime.HasValue && parsedResponse.DurationMinutes.HasValue)
                {
                    var (bookingSuccess, bookingMessage, bookingId) = await _bookingService.CreateAdminBooking(
                        null, // Sin ID de usuario registrado (es invitado público)
                        parsedResponse.GuestName,
                        parsedResponse.GuestPhone,
                        parsedResponse.GuestEmail,
                        parsedResponse.GuestDni,
                        parsedResponse.CourtId.Value,
                        parsedResponse.StartTime.Value,
                        parsedResponse.DurationMinutes.Value
                    );

                    if (bookingSuccess)
                    {
                        parsedResponse.Reply = $"🎾 **¡Tu Reserva ha sido Confirmada!**\n\n{parsedResponse.Reply}\n\n✔️ **Detalles del Turno:**\n- **Código:** `{bookingId}`\n- **Nombre:** {parsedResponse.GuestName}\n- **DNI:** {parsedResponse.GuestDni}\n- **Resultado:** {bookingMessage}";
                    }
                    else
                    {
                        parsedResponse.Reply = $"❌ **No se pudo completar la reserva:** {bookingMessage}\n\n¿Deseas buscar otro horario?";
                        parsedResponse.Action = "none";
                    }
                }

                return parsedResponse;
            }
            catch (Exception ex)
            {
                return new ChatbotResponseDto
                {
                    Reply = $"⚠️ Ocurrió un error inesperado al procesar tu solicitud: {ex.Message}",
                    Action = "none",
                    Success = false
                };
            }
        }

        private DateTime GetArgentinaTime()
        {
            TimeZoneInfo argTimeZone;
            try
            {
                argTimeZone = TimeZoneInfo.FindSystemTimeZoneById("America/Argentina/Buenos_Aires");
            }
            catch (TimeZoneNotFoundException)
            {
                try
                {
                    argTimeZone = TimeZoneInfo.FindSystemTimeZoneById("Argentina Standard Time");
                }
                catch (TimeZoneNotFoundException)
                {
                    argTimeZone = TimeZoneInfo.CreateCustomTimeZone("Argentina", TimeSpan.FromHours(-3), "Argentina Standard Time", "Argentina Standard Time");
                }
            }
            return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, argTimeZone);
        }
    }

    // Clases auxiliares para mapear la respuesta de Gemini
    public class GeminiResponse
    {
        [JsonPropertyName("candidates")]
        public List<Candidate>? Candidates { get; set; }
    }

    public class Candidate
    {
        [JsonPropertyName("content")]
        public Content? Content { get; set; }
    }

    public class Content
    {
        [JsonPropertyName("parts")]
        public List<Part>? Parts { get; set; }
    }

    public class Part
    {
        [JsonPropertyName("text")]
        public string? Text { get; set; }
    }
}
