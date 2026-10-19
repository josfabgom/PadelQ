using System;
using System.Collections.Concurrent;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PadelQ.Application.Common.Interfaces;
using PadelQ.Domain.Entities;
using PadelQ.Infrastructure.Persistence;

namespace PadelQ.Infrastructure.Services
{
    public class CloverService : ICloverService
    {
        private const string PackageName = "com.clover.remote.protocol.websocket";
        private const string RemoteSourceSdk = "com.clover.cloverconnector.cloud:4.1.2";
        private const string RemoteAppId = "com.padelq.pos:1.0.0";

        private static readonly ConcurrentDictionary<int, ClientWebSocket> ActiveSessions = new();

        private readonly HttpClient _httpClient;
        private readonly ApplicationDbContext _context;
        private readonly IServiceScopeFactory _scopeFactory;

        public CloverService(HttpClient httpClient, ApplicationDbContext context, IServiceScopeFactory scopeFactory)
        {
            _httpClient = httpClient;
            _context = context;
            _scopeFactory = scopeFactory;
        }

        public async Task<bool> SendPaymentToDeviceAsync(decimal amount, string orderId, string deviceId)
        {
            int auditId = await InitiatePaymentOnDeviceAsync(amount, orderId, deviceId);
            return auditId > 0;
        }

        public async Task<int> InitiatePaymentOnDeviceAsync(
            decimal amount,
            string orderId,
            string deviceId,
            string sourceModule = "Cobro POS",
            string? clientName = null,
            string? description = null,
            string? processedBy = null)
        {
            var settings = await _context.CloverSettings.FirstOrDefaultAsync();
            if (settings == null || string.IsNullOrWhiteSpace(settings.AccessToken) || string.IsNullOrWhiteSpace(settings.MerchantId))
            {
                throw new Exception("Clover no está configurado (faltan Merchant ID o Access Token).");
            }

            string merchantId = settings.MerchantId.Trim();
            string accessToken = settings.AccessToken.Trim();
            string cleanDeviceInput = (deviceId ?? string.Empty).Trim();

            var candidateBaseUrls = settings.IsProduction
                ? new[] { "https://api.la.clover.com", "https://api.clover.com" }
                : new[] { "https://apisandbox.dev.clover.com", "https://sandbox.dev.clover.com" };

            string? activeBaseUrl = null;
            string? resolvedDeviceUuid = null;
            string? resolvedSerial = null;

            foreach (var candidateUrl in candidateBaseUrls)
            {
                using var req = new HttpRequestMessage(HttpMethod.Get, $"{candidateUrl}/v3/merchants/{merchantId}/devices");
                req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
                var devRes = await _httpClient.SendAsync(req);
                if (!devRes.IsSuccessStatusCode)
                    continue;

                activeBaseUrl = candidateUrl;
                var devJson = await devRes.Content.ReadAsStringAsync();
                var devRoot = JsonNode.Parse(devJson);
                var elements = devRoot?["elements"]?.AsArray();
                if (elements != null && elements.Count > 0)
                {
                    foreach (var el in elements)
                    {
                        var serial = el?["serial"]?.GetValue<string>()?.Trim();
                        var id = el?["id"]?.GetValue<string>()?.Trim();
                        if (!string.IsNullOrEmpty(cleanDeviceInput) &&
                            (string.Equals(serial, cleanDeviceInput, StringComparison.OrdinalIgnoreCase) ||
                             string.Equals(id, cleanDeviceInput, StringComparison.OrdinalIgnoreCase)))
                        {
                            resolvedDeviceUuid = id;
                            resolvedSerial = serial ?? cleanDeviceInput;
                            break;
                        }
                    }

                    if (string.IsNullOrEmpty(resolvedDeviceUuid))
                    {
                        resolvedDeviceUuid = elements[0]?["id"]?.GetValue<string>()?.Trim();
                        resolvedSerial = elements[0]?["serial"]?.GetValue<string>()?.Trim() ?? resolvedDeviceUuid;
                    }
                }
                break;
            }

            if (string.IsNullOrEmpty(activeBaseUrl))
            {
                throw new Exception("Credenciales de Clover inválidas o sin permisos para consultar el comercio.");
            }

            if (string.IsNullOrEmpty(resolvedDeviceUuid))
            {
                throw new Exception($"No se encontró la terminal Clover '{cleanDeviceInput}' asociada al comercio {merchantId}.");
            }

            string extPaymentId = "PQ" + Guid.NewGuid().ToString("N").Substring(0, 10).ToUpperInvariant();
            var audit = new CloverPaymentAudit
            {
                ExternalPaymentId = extPaymentId,
                OrderReference = orderId,
                SourceModule = string.IsNullOrWhiteSpace(sourceModule) ? "Cobro POS" : sourceModule,
                ClientName = string.IsNullOrWhiteSpace(clientName) ? "Consumidor Final" : clientName,
                Description = description,
                ProcessedBy = processedBy,
                DeviceId = resolvedSerial ?? cleanDeviceInput,
                Amount = amount,
                Status = "PENDING",
                StatusDetail = "Esperando pago en la terminal Clover...",
                CreatedAt = PadelQ.Domain.TimeZoneHelper.GetArgNow()
            };
            _context.CloverPaymentAudits.Add(audit);
            await _context.SaveChangesAsync();

            // 1. Notificar a la terminal (remote_pay) y obtener el host WebSocket de Cloud Pay Display
            string cleanUuidNoHyphens = resolvedDeviceUuid.Replace("-", "");
            using var alertReq = new HttpRequestMessage(HttpMethod.Post, $"{activeBaseUrl}/v2/merchant/{merchantId}/remote_pay");
            alertReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            alertReq.Content = JsonContent.Create(new { deviceId = cleanUuidNoHyphens, isSilent = true });

            var alertRes = await _httpClient.SendAsync(alertReq);
            var alertBody = await alertRes.Content.ReadAsStringAsync();
            if (!alertRes.IsSuccessStatusCode)
            {
                audit.Status = "ERROR";
                audit.StatusDetail = $"Error remote_pay ({alertRes.StatusCode}): {alertBody}";
                audit.CompletedAt = PadelQ.Domain.TimeZoneHelper.GetArgNow();
                await _context.SaveChangesAsync();
                throw new Exception($"Error inicializando conexión con Clover ({alertRes.StatusCode}): {alertBody}");
            }

            var alertNode = JsonNode.Parse(alertBody);
            string? wsHost = alertNode?["host"]?.GetValue<string>()?.TrimEnd('/');
            string? wsToken = alertNode?["token"]?.GetValue<string>();
            string? serverIdentifier = alertNode?["serverIdentifier"]?.GetValue<string>();

            if (string.IsNullOrEmpty(wsHost) || string.IsNullOrEmpty(wsToken))
            {
                audit.Status = "ERROR";
                audit.StatusDetail = "Respuesta incompleta de Clover remote_pay.";
                audit.CompletedAt = PadelQ.Domain.TimeZoneHelper.GetArgNow();
                await _context.SaveChangesAsync();
                throw new Exception($"Respuesta incompleta de Clover remote_pay: {alertBody}");
            }

            string wsEndpoint = $"{wsHost}/support/remote_pay/cs?token={Uri.EscapeDataString(wsToken)}&friendlyId=PadelQ&forceConnect=true";
            if (!string.IsNullOrEmpty(serverIdentifier))
            {
                wsEndpoint += $"&server={Uri.EscapeDataString(serverIdentifier)}";
            }

            // 2. Llamada OPTIONS previa para evitar 401 en el proxy WebSocket de Clover
            string httpEndpoint = wsEndpoint.StartsWith("wss://", StringComparison.OrdinalIgnoreCase)
                ? "https://" + wsEndpoint.Substring(6)
                : wsEndpoint.Replace("ws://", "http://");
            try
            {
                using var optReq = new HttpRequestMessage(HttpMethod.Options, httpEndpoint);
                optReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
                await _httpClient.SendAsync(optReq);
            }
            catch
            {
                // Ignorar errores de preflight si el proxy responde directo por WSS
            }

            // 3. Conectar por WebSocket a Cloud Pay Display y enviar DISCOVERY_REQUEST + TX_START
            var ws = new ClientWebSocket();
            ws.Options.AddSubProtocol(accessToken);
            ws.Options.SetRequestHeader("Authorization", $"Bearer {accessToken}");

            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(18));
            try
            {
                await ws.ConnectAsync(new Uri(wsEndpoint), cts.Token);

                await SendRemoteCommandAsync(ws, "1", "DISCOVERY_REQUEST", new
                {
                    method = "DISCOVERY_REQUEST",
                    version = 1,
                    supportsOrderModification = false
                }, cts.Token);

                bool discoveryReceived = false;
                bool retriedAfterBreak = false;
                long amountCents = (long)Math.Round(amount * 100m);

                while (ws.State == WebSocketState.Open && !cts.Token.IsCancellationRequested)
                {
                    string? rawMsg = await ReceiveFullTextMessageAsync(ws, cts.Token);
                    if (rawMsg == null)
                        break;

                    JsonNode? msgNode;
                    try
                    {
                        msgNode = JsonNode.Parse(rawMsg);
                    }
                    catch
                    {
                        continue;
                    }

                    string? msgType = msgNode?["type"]?.GetValue<string>();
                    if (string.Equals(msgType, "PING", StringComparison.OrdinalIgnoreCase))
                    {
                        await SendPongAsync(ws, cts.Token);
                        continue;
                    }

                    string? method = msgNode?["method"]?.GetValue<string>();
                    string? payloadStr = msgNode?["payload"]?.GetValue<string>();

                    if (!discoveryReceived && string.Equals(method, "DISCOVERY_RESPONSE", StringComparison.OrdinalIgnoreCase))
                    {
                        discoveryReceived = true;
                        await SendTxStartAsync(ws, "2", amountCents, extPaymentId, cts.Token);
                        continue;
                    }

                    if (discoveryReceived)
                    {
                        if (string.Equals(method, "TX_START_RESPONSE", StringComparison.OrdinalIgnoreCase))
                        {
                            var payloadNode = !string.IsNullOrEmpty(payloadStr) ? JsonNode.Parse(payloadStr) : null;
                            string? result = payloadNode?["result"]?.GetValue<string>();

                            if (string.Equals(result, "SUCCESS", StringComparison.OrdinalIgnoreCase))
                            {
                                ActiveSessions[audit.Id] = ws;
                                _ = MonitorPaymentSessionAsync(ws, audit.Id);
                                return audit.Id;
                            }

                            if (!retriedAfterBreak)
                            {
                                retriedAfterBreak = true;
                                await SendRemoteCommandAsync(ws, "3", "BREAK", new
                                {
                                    method = "BREAK",
                                    messageId = "3",
                                    version = 0
                                }, cts.Token);
                                await Task.Delay(900, cts.Token);
                                extPaymentId = "PQ" + Guid.NewGuid().ToString("N").Substring(0, 10).ToUpperInvariant();
                                audit.ExternalPaymentId = extPaymentId;
                                await _context.SaveChangesAsync();
                                await SendTxStartAsync(ws, "4", amountCents, extPaymentId, cts.Token);
                                continue;
                            }

                            string reason = payloadNode?["reason"]?.GetValue<string>() ?? payloadNode?["message"]?.GetValue<string>() ?? result ?? "Error desconocido";
                            audit.Status = "ERROR";
                            audit.StatusDetail = $"Terminal rechazó iniciar el cobro: {reason}";
                            audit.CompletedAt = PadelQ.Domain.TimeZoneHelper.GetArgNow();
                            await _context.SaveChangesAsync();
                            ws.Dispose();
                            throw new Exception($"La terminal Clover rechazó iniciar el cobro: {reason}");
                        }

                        if (string.Equals(method, "UI_STATE", StringComparison.OrdinalIgnoreCase) ||
                            string.Equals(method, "TX_STATE", StringComparison.OrdinalIgnoreCase))
                        {
                            ActiveSessions[audit.Id] = ws;
                            _ = MonitorPaymentSessionAsync(ws, audit.Id);
                            return audit.Id;
                        }
                    }
                }

                ws.Dispose();
                audit.Status = "ERROR";
                audit.StatusDetail = !discoveryReceived
                    ? "La terminal Clover no respondió (verifique Cloud Pay Display)."
                    : "Se agotó el tiempo de espera inicial con la terminal Clover.";
                audit.CompletedAt = PadelQ.Domain.TimeZoneHelper.GetArgNow();
                await _context.SaveChangesAsync();

                if (!discoveryReceived)
                {
                    throw new Exception("La terminal Clover no respondió. Verifique que esté encendida, con internet y con la app 'Cloud Pay Display' abierta.");
                }

                throw new Exception("Se agotó el tiempo de espera aguardando respuesta de la terminal Clover.");
            }
            catch (Exception ex)
            {
                ws.Dispose();
                if (audit.Status == "PENDING")
                {
                    audit.Status = "ERROR";
                    audit.StatusDetail = ex.Message;
                    audit.CompletedAt = PadelQ.Domain.TimeZoneHelper.GetArgNow();
                    await _context.SaveChangesAsync();
                }
                throw;
            }
        }

        private static JsonNode? UnwrapJsonNode(JsonNode? node)
        {
            if (node == null) return null;
            if (node is JsonValue val && val.TryGetValue<string>(out var str) && !string.IsNullOrWhiteSpace(str))
            {
                var trimmed = str.Trim();
                if ((trimmed.StartsWith("{") && trimmed.EndsWith("}")) ||
                    (trimmed.StartsWith("[") && trimmed.EndsWith("]")))
                {
                    try
                    {
                        return JsonNode.Parse(trimmed);
                    }
                    catch
                    {
                        return node;
                    }
                }
            }
            return node;
        }

        private async Task MonitorPaymentSessionAsync(ClientWebSocket ws, int auditId)
        {
            using var cts = new CancellationTokenSource(TimeSpan.FromMinutes(5));
            int msgCounter = 10;
            bool finalStateRecorded = false;

            try
            {
                while (ws.State == WebSocketState.Open && !cts.Token.IsCancellationRequested)
                {
                    string? rawMsg = await ReceiveFullTextMessageAsync(ws, cts.Token);
                    if (rawMsg == null)
                        break;

                    JsonNode? msgNode;
                    try
                    {
                        msgNode = JsonNode.Parse(rawMsg);
                    }
                    catch
                    {
                        continue;
                    }

                    string? msgType = msgNode?["type"]?.GetValue<string>();
                    if (string.Equals(msgType, "PING", StringComparison.OrdinalIgnoreCase))
                    {
                        await SendPongAsync(ws, cts.Token);
                        continue;
                    }

                    string? method = msgNode?["method"]?.GetValue<string>();
                    string? payloadStr = msgNode?["payload"]?.GetValue<string>();

                    if (string.Equals(method, "CONFIRM_PAYMENT_MESSAGE", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrEmpty(payloadStr))
                    {
                        var payloadNode = UnwrapJsonNode(JsonNode.Parse(payloadStr));
                        var paymentNode = payloadNode?["payment"];
                        string nextId = (++msgCounter).ToString();
                        await SendRemoteCommandAsync(ws, nextId, "PAYMENT_CONFIRMED", new
                        {
                            method = "PAYMENT_CONFIRMED",
                            messageId = nextId,
                            version = 0,
                            payment = paymentNode
                        }, cts.Token);
                    }
                    else if (string.Equals(method, "VERIFY_SIGNATURE", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrEmpty(payloadStr))
                    {
                        var payloadNode = UnwrapJsonNode(JsonNode.Parse(payloadStr));
                        var paymentNode = payloadNode?["payment"];
                        string nextId = (++msgCounter).ToString();
                        await SendRemoteCommandAsync(ws, nextId, "SIGNATURE_VERIFIED", new
                        {
                            method = "SIGNATURE_VERIFIED",
                            messageId = nextId,
                            version = 0,
                            payment = paymentNode,
                            verified = true
                        }, cts.Token);
                    }
                    else if (string.Equals(method, "TX_START_RESPONSE", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrEmpty(payloadStr))
                    {
                        var payloadNode = UnwrapJsonNode(JsonNode.Parse(payloadStr));
                        string? result = payloadNode?["result"]?.GetValue<string>();
                        if (!string.IsNullOrEmpty(result) && !string.Equals(result, "SUCCESS", StringComparison.OrdinalIgnoreCase))
                        {
                            string reason = payloadNode?["reason"]?.GetValue<string>() ?? payloadNode?["message"]?.GetValue<string>() ?? result;
                            await UpdateAuditRecordAsync(
                                auditId,
                                "ERROR",
                                $"La terminal Clover rechazó iniciar el cobro: {reason}");
                            finalStateRecorded = true;
                            break;
                        }
                    }
                    else if (string.Equals(method, "FINISH_OK", StringComparison.OrdinalIgnoreCase))
                    {
                        string? cloverPayId = null;
                        string? cloverOrdId = null;
                        string? cardBrand = null;
                        string? cardLast4 = null;
                        string? authCode = null;
                        string? entryType = null;
                        string? paymentResult = null;

                        if (!string.IsNullOrEmpty(payloadStr))
                        {
                            try
                            {
                                var payloadNode = UnwrapJsonNode(JsonNode.Parse(payloadStr));
                                var paymentNode = UnwrapJsonNode(payloadNode?["payment"]);
                                var orderNode = UnwrapJsonNode(paymentNode?["order"]);
                                var cardTx = UnwrapJsonNode(paymentNode?["cardTransaction"]);
                                var tenderNode = UnwrapJsonNode(paymentNode?["tender"]);

                                cloverPayId = paymentNode?["id"]?.GetValue<string>();
                                cloverOrdId = orderNode?["id"]?.GetValue<string>();
                                paymentResult = paymentNode?["result"]?.GetValue<string>();
                                cardBrand = cardTx?["cardType"]?.GetValue<string>();
                                cardLast4 = cardTx?["last4"]?.GetValue<string>();
                                authCode = cardTx?["authCode"]?.GetValue<string>();
                                entryType = cardTx?["entryType"]?.GetValue<string>();

                                string? tenderLabel = tenderNode?["label"]?.GetValue<string>();
                                if (!string.IsNullOrWhiteSpace(tenderLabel) &&
                                    tenderLabel.Contains("QR", StringComparison.OrdinalIgnoreCase))
                                {
                                    cardBrand = (!string.IsNullOrWhiteSpace(cardBrand) && cardBrand != "OTHER")
                                        ? $"QR PosNet ({cardBrand})"
                                        : "QR PosNet";
                                    if (string.IsNullOrWhiteSpace(entryType))
                                        entryType = "QR_POSNET";
                                }
                            }
                            catch
                            {
                                // Continuar aunque algún campo opcional no venga en el JSON
                            }
                        }

                        if (!string.IsNullOrEmpty(paymentResult) &&
                            (string.Equals(paymentResult, "FAIL", StringComparison.OrdinalIgnoreCase) ||
                             string.Equals(paymentResult, "DECLINED", StringComparison.OrdinalIgnoreCase)))
                        {
                            await UpdateAuditRecordAsync(
                                auditId,
                                "CANCELLED",
                                $"Pago rechazado en la terminal Clover ({paymentResult})");
                        }
                        else
                        {
                            await UpdateAuditRecordAsync(
                                auditId,
                                "APPROVED",
                                "Pago aprobado en la terminal Clover",
                                cloverPayId,
                                cloverOrdId,
                                cardBrand,
                                cardLast4,
                                authCode,
                                entryType);

                            // Enriquecer inmediatamente con los servidores de Clover si faltan datos de cupón/tarjeta
                            if (string.IsNullOrEmpty(cloverPayId) || string.IsNullOrEmpty(cardBrand))
                            {
                                try
                                {
                                    using var verifyScope = _scopeFactory.CreateScope();
                                    var scopedClover = verifyScope.ServiceProvider.GetRequiredService<ICloverService>();
                                    await scopedClover.VerifyPaymentWithCloverAsync(auditId);
                                }
                                catch
                                {
                                    // Ignorar si la API REST demora en indexar
                                }
                            }
                        }

                        finalStateRecorded = true;

                        string nextId = (++msgCounter).ToString();
                        await SendRemoteCommandAsync(ws, nextId, "SHOW_WELCOME_SCREEN", new
                        {
                            method = "SHOW_WELCOME_SCREEN",
                            messageId = nextId,
                            version = 0
                        }, cts.Token);
                        break;
                    }
                    else if (string.Equals(method, "FINISH_CANCEL", StringComparison.OrdinalIgnoreCase))
                    {
                        // Verificar primero en Clover REST por si el cliente pagó con QR PosNet antes de cerrarse la pantalla
                        try
                        {
                            using var verifyScope = _scopeFactory.CreateScope();
                            var scopedClover = verifyScope.ServiceProvider.GetRequiredService<ICloverService>();
                            await scopedClover.VerifyPaymentWithCloverAsync(auditId);
                        }
                        catch
                        {
                            // Ignorar error de consulta REST
                        }

                        await UpdateAuditRecordAsync(
                            auditId,
                            "CANCELLED",
                            "Pago cancelado desde la terminal física Clover");

                        finalStateRecorded = true;

                        string nextId = (++msgCounter).ToString();
                        await SendRemoteCommandAsync(ws, nextId, "SHOW_WELCOME_SCREEN", new
                        {
                            method = "SHOW_WELCOME_SCREEN",
                            messageId = nextId,
                            version = 0
                        }, cts.Token);
                        break;
                    }
                }

                if (!finalStateRecorded)
                {
                    try
                    {
                        using var verifyScope = _scopeFactory.CreateScope();
                        var scopedClover = verifyScope.ServiceProvider.GetRequiredService<ICloverService>();
                        await scopedClover.VerifyPaymentWithCloverAsync(auditId);
                    }
                    catch
                    {
                        // Ignorar error de verificación automática en segundo plano
                    }

                    if (cts.Token.IsCancellationRequested)
                    {
                        await UpdateAuditRecordAsync(
                            auditId,
                            "TIMEOUT",
                            "Tiempo de espera agotado (5 min) sin completar el pago en la terminal.");
                    }
                }

                if (ws.State == WebSocketState.Open)
                {
                    await ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "Done", CancellationToken.None);
                }
            }
            catch
            {
                // Ignorar desconexiones en el cierre de segundo plano
            }
            finally
            {
                ActiveSessions.TryRemove(auditId, out _);
                ws.Dispose();
            }
        }

        private async Task UpdateAuditRecordAsync(
            int auditId,
            string status,
            string statusDetail,
            string? cloverPaymentId = null,
            string? cloverOrderId = null,
            string? cardBrand = null,
            string? cardLast4 = null,
            string? authCode = null,
            string? entryType = null)
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var audit = await db.CloverPaymentAudits.FirstOrDefaultAsync(a => a.Id == auditId);
            if (audit == null) return;

            // No sobreescribir si ya quedó APPROVED
            if (audit.Status == "APPROVED" && status != "APPROVED") return;

            audit.Status = status;
            audit.StatusDetail = statusDetail;
            if (!string.IsNullOrEmpty(cloverPaymentId)) audit.CloverPaymentId = cloverPaymentId;
            if (!string.IsNullOrEmpty(cloverOrderId)) audit.CloverOrderId = cloverOrderId;
            if (!string.IsNullOrEmpty(cardBrand)) audit.CardBrand = cardBrand;
            if (!string.IsNullOrEmpty(cardLast4)) audit.CardLast4 = cardLast4;
            if (!string.IsNullOrEmpty(authCode)) audit.AuthCode = authCode;
            if (!string.IsNullOrEmpty(entryType)) audit.EntryType = entryType;
            audit.CompletedAt = PadelQ.Domain.TimeZoneHelper.GetArgNow();

            await db.SaveChangesAsync();
        }

        public async Task<bool> CancelPaymentOnDeviceAsync(int auditId)
        {
            var audit = await _context.CloverPaymentAudits.FirstOrDefaultAsync(a => a.Id == auditId);
            if (audit == null) return false;

            // Antes de cancelar, verificar en los servidores de Clover si el cobro ya fue aprobado (ej. QR PosNet)
            if (audit.Status == "PENDING")
            {
                try
                {
                    await VerifyPaymentWithCloverAsync(auditId);
                    await _context.Entry(audit).ReloadAsync();
                }
                catch
                {
                    // Continuar con cancelación si no se pudo verificar
                }
            }

            if (audit.Status == "APPROVED")
            {
                // El pago ya se concretó en la terminal física; no cancelar
                return true;
            }

            if (ActiveSessions.TryRemove(auditId, out var ws))
            {
                try
                {
                    if (ws.State == WebSocketState.Open)
                    {
                        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
                        await SendRemoteCommandAsync(ws, "99", "BREAK", new
                        {
                            method = "BREAK",
                            messageId = "99",
                            version = 0
                        }, cts.Token);
                        await SendRemoteCommandAsync(ws, "100", "SHOW_WELCOME_SCREEN", new
                        {
                            method = "SHOW_WELCOME_SCREEN",
                            messageId = "100",
                            version = 0
                        }, cts.Token);
                        await ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "Cancelled by user", CancellationToken.None);
                    }
                }
                catch
                {
                    // Ignorar si ya estaba cerrada
                }
                finally
                {
                    ws.Dispose();
                }
            }

            if (audit.Status == "PENDING")
            {
                audit.Status = "CANCELLED";
                audit.StatusDetail = "Cobro cancelado en la terminal Clover";
                audit.CompletedAt = PadelQ.Domain.TimeZoneHelper.GetArgNow();
                await _context.SaveChangesAsync();
            }

            return true;
        }

        public async Task<object> VerifyPaymentWithCloverAsync(int auditId)
        {
            var audit = await _context.CloverPaymentAudits.FirstOrDefaultAsync(a => a.Id == auditId);
            if (audit == null)
                throw new Exception("Registro de auditoría Clover no encontrado.");

            var settings = await _context.CloverSettings.FirstOrDefaultAsync();
            if (settings == null || string.IsNullOrWhiteSpace(settings.AccessToken) || string.IsNullOrWhiteSpace(settings.MerchantId))
                throw new Exception("Credenciales de Clover no configuradas.");

            string merchantId = settings.MerchantId.Trim();
            string accessToken = settings.AccessToken.Trim();
            string baseUrl = settings.IsProduction ? "https://api.la.clover.com" : "https://apisandbox.dev.clover.com";

            JsonNode? paymentNode = null;

            // 1. Si tenemos CloverPaymentId, consultarlo directo en /v3/merchants/{mId}/payments/{id}
            if (!string.IsNullOrWhiteSpace(audit.CloverPaymentId))
            {
                using var req = new HttpRequestMessage(
                    HttpMethod.Get,
                    $"{baseUrl}/v3/merchants/{merchantId}/payments/{Uri.EscapeDataString(audit.CloverPaymentId)}?expand=cardTransaction,tender,order");
                req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
                var res = await _httpClient.SendAsync(req);
                if (res.IsSuccessStatusCode)
                {
                    var json = await res.Content.ReadAsStringAsync();
                    paymentNode = JsonNode.Parse(json);
                }
            }

            // 2. Si no teníamos CloverPaymentId, buscar por externalPaymentId en Clover (cubre Tarjeta Débito / Crédito)
            if (paymentNode == null && !string.IsNullOrWhiteSpace(audit.ExternalPaymentId) && !audit.ExternalPaymentId.StartsWith("HIST-"))
            {
                using var req = new HttpRequestMessage(
                    HttpMethod.Get,
                    $"{baseUrl}/v3/merchants/{merchantId}/payments?filter=externalPaymentId={Uri.EscapeDataString(audit.ExternalPaymentId)}&expand=cardTransaction,tender,order");
                req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
                var res = await _httpClient.SendAsync(req);
                if (res.IsSuccessStatusCode)
                {
                    var json = await res.Content.ReadAsStringAsync();
                    var root = JsonNode.Parse(json);
                    var elements = root?["elements"]?.AsArray();
                    if (elements != null && elements.Count > 0)
                    {
                        paymentNode = elements[0];
                    }
                }
            }

            // 3. Si no apareció por externalPaymentId, buscar en los últimos pagos del comercio por monto + ventana temporal
            // Esto cubre pagos con "QR PosNet" (ar.com.fiserv.fiservqr.prod) en la terminal Clover, donde Fiserv sobreescribe externalPaymentId
            if (paymentNode == null)
            {
                using var req = new HttpRequestMessage(
                    HttpMethod.Get,
                    $"{baseUrl}/v3/merchants/{merchantId}/payments?limit=25&expand=cardTransaction,tender,order,device");
                req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
                var res = await _httpClient.SendAsync(req);
                if (res.IsSuccessStatusCode)
                {
                    var json = await res.Content.ReadAsStringAsync();
                    var root = JsonNode.Parse(json);
                    var elements = root?["elements"]?.AsArray();
                    if (elements != null && elements.Count > 0)
                    {
                        long targetAmountCents = (long)Math.Round(audit.Amount * 100m);

                        var usedPaymentIds = await _context.CloverPaymentAudits
                            .Where(a => a.Id != audit.Id && a.CloverPaymentId != null && a.CloverPaymentId != "")
                            .Select(a => a.CloverPaymentId!)
                            .ToListAsync();

                        var unspecifiedStart = DateTime.SpecifyKind(audit.CreatedAt, DateTimeKind.Unspecified);
                        long startArgMs = new DateTimeOffset(unspecifiedStart, TimeSpan.FromHours(-3)).ToUnixTimeMilliseconds();
                        long startUtcMs = new DateTimeOffset(unspecifiedStart, TimeSpan.Zero).ToUnixTimeMilliseconds();

                        foreach (var el in elements)
                        {
                            if (el == null) continue;
                            string? elId = el["id"]?.GetValue<string>();
                            string? elResult = el["result"]?.GetValue<string>();
                            long? elAmount = el["amount"]?.GetValue<long>();
                            long? elCreatedMs = el["createdTime"]?.GetValue<long>();
                            string? elExtId = el["externalPaymentId"]?.GetValue<string>();

                            if (string.IsNullOrEmpty(elId) || usedPaymentIds.Contains(elId))
                                continue;

                            if (!string.Equals(elResult, "SUCCESS", StringComparison.OrdinalIgnoreCase))
                                continue;

                            if (!elAmount.HasValue || elAmount.Value != targetAmountCents)
                                continue;

                            if (!string.IsNullOrEmpty(elExtId) &&
                                elExtId.StartsWith("PQ", StringComparison.OrdinalIgnoreCase) &&
                                !string.Equals(elExtId, audit.ExternalPaymentId, StringComparison.OrdinalIgnoreCase))
                            {
                                continue;
                            }

                            if (elCreatedMs.HasValue)
                            {
                                bool matchesArgWindow = elCreatedMs.Value >= (startArgMs - 25000) && elCreatedMs.Value <= (startArgMs + 360000);
                                bool matchesUtcWindow = audit.Id <= 485 && elCreatedMs.Value >= (startUtcMs - 25000) && elCreatedMs.Value <= (startUtcMs + 360000);

                                if (matchesArgWindow || matchesUtcWindow)
                                {
                                    paymentNode = el;
                                    break;
                                }
                            }
                        }
                    }
                }
            }

            if (paymentNode != null)
            {
                string? cloverPayId = paymentNode["id"]?.GetValue<string>();
                string? cloverOrdId = paymentNode["order"]?["id"]?.GetValue<string>();
                string? cloverResult = paymentNode["result"]?.GetValue<string>();
                long? amountCents = paymentNode["amount"]?.GetValue<long>();
                var cardTx = paymentNode["cardTransaction"];
                var tenderNode = paymentNode["tender"];
                string? cardBrand = cardTx?["cardType"]?.GetValue<string>();
                string? cardLast4 = cardTx?["last4"]?.GetValue<string>();
                string? authCode = cardTx?["authCode"]?.GetValue<string>();
                string? entryType = cardTx?["entryType"]?.GetValue<string>();
                string? tenderLabel = tenderNode?["label"]?.GetValue<string>();

                if (!string.IsNullOrWhiteSpace(tenderLabel) &&
                    tenderLabel.Contains("QR", StringComparison.OrdinalIgnoreCase))
                {
                    cardBrand = (!string.IsNullOrWhiteSpace(cardBrand) && cardBrand != "OTHER")
                        ? $"QR PosNet ({cardBrand})"
                        : "QR PosNet";
                    if (string.IsNullOrWhiteSpace(entryType))
                        entryType = "QR_POSNET";
                }

                if (!string.IsNullOrEmpty(cloverPayId)) audit.CloverPaymentId = cloverPayId;
                if (!string.IsNullOrEmpty(cloverOrdId)) audit.CloverOrderId = cloverOrdId;
                if (!string.IsNullOrEmpty(cardBrand)) audit.CardBrand = cardBrand;
                if (!string.IsNullOrEmpty(cardLast4)) audit.CardLast4 = cardLast4;
                if (!string.IsNullOrEmpty(authCode)) audit.AuthCode = authCode;
                if (!string.IsNullOrEmpty(entryType)) audit.EntryType = entryType;

                if (string.Equals(cloverResult, "SUCCESS", StringComparison.OrdinalIgnoreCase) && audit.Status != "APPROVED")
                {
                    audit.Status = "APPROVED";
                    audit.StatusDetail = !string.IsNullOrWhiteSpace(tenderLabel) && tenderLabel.Contains("QR", StringComparison.OrdinalIgnoreCase)
                        ? "Pago con QR PosNet verificado y aprobado en la terminal Clover"
                        : "Pago verificado y aprobado en los servidores de Clover";
                    audit.CompletedAt ??= PadelQ.Domain.TimeZoneHelper.GetArgNow();
                }
                await _context.SaveChangesAsync();

                return new
                {
                    foundInClover = true,
                    cloverPaymentId = audit.CloverPaymentId,
                    externalPaymentId = audit.ExternalPaymentId,
                    cloverResult = cloverResult ?? "SUCCESS",
                    amount = amountCents.HasValue ? amountCents.Value / 100m : audit.Amount,
                    cardBrand = audit.CardBrand ?? "-",
                    cardLast4 = audit.CardLast4 ?? "-",
                    authCode = audit.AuthCode ?? "-",
                    entryType = audit.EntryType ?? "-",
                    status = audit.Status,
                    statusDetail = audit.StatusDetail,
                    deviceId = audit.DeviceId,
                    date = (audit.CompletedAt ?? audit.CreatedAt).ToString("dd/MM/yyyy HH:mm:ss"),
                    message = $"Comprobante verificado en tiempo real en los servidores de Clover ({merchantId})."
                };
            }

            return new
            {
                foundInClover = false,
                cloverPaymentId = audit.CloverPaymentId ?? "-",
                externalPaymentId = audit.ExternalPaymentId,
                cloverResult = audit.Status == "CANCELLED" ? "CANCELLED_ON_TERMINAL" : audit.Status,
                amount = audit.Amount,
                cardBrand = audit.CardBrand ?? "-",
                cardLast4 = audit.CardLast4 ?? "-",
                authCode = audit.AuthCode ?? "-",
                entryType = audit.EntryType ?? "-",
                status = audit.Status,
                statusDetail = audit.StatusDetail,
                deviceId = audit.DeviceId,
                date = (audit.CompletedAt ?? audit.CreatedAt).ToString("dd/MM/yyyy HH:mm:ss"),
                message = audit.Status == "CANCELLED"
                    ? "Esta operación fue cancelada en la terminal física antes de procesarse el cargo con tarjeta."
                    : (audit.ExternalPaymentId.StartsWith("HIST-")
                        ? "Transacción histórica registrada en PadelQ previo a la activación del detalle de cupón Clover."
                        : "No se registra cargo cobrado en los servidores de Clover para este intento.")
            };
        }

        private static async Task SendTxStartAsync(ClientWebSocket ws, string messageId, long amountCents, string externalPaymentId, CancellationToken ct)
        {
            var txStartPayload = new
            {
                method = "TX_START",
                messageId = messageId,
                version = 2,
                order = (object?)null,
                requestInfo = "SALE",
                payIntent = new
                {
                    action = "com.clover.remote.protocol.action.START_REMOTE_PROTOCOL_PAY",
                    amount = amountCents,
                    tipAmount = 0,
                    transactionType = "PAYMENT",
                    externalPaymentId = externalPaymentId,
                    requiresRemoteConfirmation = false,
                    allowPartialAuth = false,
                    transactionSettings = new
                    {
                        cardEntryMethods = 34567,
                        disableCashBack = true,
                        cloverShouldHandleReceipts = true,
                        forcePinEntryOnSwipe = false,
                        disableRestartTransactionOnFailure = false,
                        allowOfflinePayment = false,
                        approveOfflinePaymentWithoutPrompt = false,
                        forceOfflinePayment = false,
                        disableReceiptSelection = false,
                        disableDuplicateCheck = false,
                        autoAcceptPaymentConfirmations = true,
                        autoAcceptSignature = true,
                        returnResultOnTransactionComplete = false
                    }
                }
            };

            await SendRemoteCommandAsync(ws, messageId, "TX_START", txStartPayload, ct);
        }

        private static async Task SendRemoteCommandAsync(ClientWebSocket ws, string id, string method, object payloadObj, CancellationToken ct)
        {
            var envelope = new
            {
                id = id,
                type = "COMMAND",
                packageName = PackageName,
                method = method,
                payload = JsonSerializer.Serialize(payloadObj),
                remoteSourceSDK = RemoteSourceSdk,
                remoteApplicationID = RemoteAppId,
                version = 1
            };

            string json = JsonSerializer.Serialize(envelope);
            byte[] bytes = Encoding.UTF8.GetBytes(json);
            await ws.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, ct);
        }

        private static async Task SendPongAsync(ClientWebSocket ws, CancellationToken ct)
        {
            var pong = new
            {
                type = "PONG",
                packageName = PackageName,
                remoteSourceSDK = RemoteSourceSdk,
                remoteApplicationID = RemoteAppId
            };
            string json = JsonSerializer.Serialize(pong);
            byte[] bytes = Encoding.UTF8.GetBytes(json);
            await ws.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, ct);
        }

        private static async Task<string?> ReceiveFullTextMessageAsync(ClientWebSocket ws, CancellationToken ct)
        {
            var buffer = new byte[8192];
            using var ms = new MemoryStream();
            while (true)
            {
                var result = await ws.ReceiveAsync(new ArraySegment<byte>(buffer), ct);
                if (result.MessageType == WebSocketMessageType.Close)
                    return null;

                ms.Write(buffer, 0, result.Count);
                if (result.EndOfMessage)
                    break;
            }
            return Encoding.UTF8.GetString(ms.ToArray());
        }

        public async Task<string> GetPaymentStatusAsync(string paymentId)
        {
            return await Task.FromResult("SUCCESS");
        }
    }
}
