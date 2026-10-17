using System;
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
using PadelQ.Application.Common.Interfaces;
using PadelQ.Infrastructure.Persistence;

namespace PadelQ.Infrastructure.Services
{
    public class CloverService : ICloverService
    {
        private const string PackageName = "com.clover.remote.protocol.websocket";
        private const string RemoteSourceSdk = "com.clover.cloverconnector.cloud:4.1.2";
        private const string RemoteAppId = "com.padelq.pos:1.0.0";

        private readonly HttpClient _httpClient;
        private readonly ApplicationDbContext _context;

        public CloverService(HttpClient httpClient, ApplicationDbContext context)
        {
            _httpClient = httpClient;
            _context = context;
        }

        public async Task<bool> SendPaymentToDeviceAsync(decimal amount, string orderId, string deviceId)
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
                            break;
                        }
                    }

                    if (string.IsNullOrEmpty(resolvedDeviceUuid))
                    {
                        resolvedDeviceUuid = elements[0]?["id"]?.GetValue<string>()?.Trim();
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

            // 1. Notificar a la terminal (remote_pay) y obtener el host WebSocket de Cloud Pay Display
            string cleanUuidNoHyphens = resolvedDeviceUuid.Replace("-", "");
            using var alertReq = new HttpRequestMessage(HttpMethod.Post, $"{activeBaseUrl}/v2/merchant/{merchantId}/remote_pay");
            alertReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            alertReq.Content = JsonContent.Create(new { deviceId = cleanUuidNoHyphens, isSilent = true });

            var alertRes = await _httpClient.SendAsync(alertReq);
            var alertBody = await alertRes.Content.ReadAsStringAsync();
            if (!alertRes.IsSuccessStatusCode)
            {
                throw new Exception($"Error inicializando conexión con Clover ({alertRes.StatusCode}): {alertBody}");
            }

            var alertNode = JsonNode.Parse(alertBody);
            string? wsHost = alertNode?["host"]?.GetValue<string>()?.TrimEnd('/');
            string? wsToken = alertNode?["token"]?.GetValue<string>();
            string? serverIdentifier = alertNode?["serverIdentifier"]?.GetValue<string>();

            if (string.IsNullOrEmpty(wsHost) || string.IsNullOrEmpty(wsToken))
            {
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
                string extPaymentId = "PQ" + Guid.NewGuid().ToString("N").Substring(0, 10).ToUpperInvariant();

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
                                // El cobro ya está en pantalla en la terminal Clover.
                                // Mantenemos viva la sesión WebSocket en segundo plano mientras el cliente pasa la tarjeta.
                                _ = KeepSessionAliveDuringPaymentAsync(ws);
                                return true;
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
                                await SendTxStartAsync(ws, "4", amountCents, extPaymentId, cts.Token);
                                continue;
                            }

                            string reason = payloadNode?["reason"]?.GetValue<string>() ?? payloadNode?["message"]?.GetValue<string>() ?? result ?? "Error desconocido";
                            ws.Dispose();
                            throw new Exception($"La terminal Clover rechazó iniciar el cobro: {reason}");
                        }

                        if (string.Equals(method, "UI_STATE", StringComparison.OrdinalIgnoreCase) ||
                            string.Equals(method, "TX_STATE", StringComparison.OrdinalIgnoreCase))
                        {
                            // Si la terminal ya cambió de estado UI hacia el cobro, también es exitoso
                            _ = KeepSessionAliveDuringPaymentAsync(ws);
                            return true;
                        }
                    }
                }

                ws.Dispose();
                if (!discoveryReceived)
                {
                    throw new Exception("La terminal Clover no respondió. Verifique que esté encendida, con internet y con la app 'Cloud Pay Display' abierta.");
                }

                throw new Exception("Se agotó el tiempo de espera aguardando respuesta de la terminal Clover.");
            }
            catch
            {
                ws.Dispose();
                throw;
            }
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

        private static async Task KeepSessionAliveDuringPaymentAsync(ClientWebSocket ws)
        {
            using var cts = new CancellationTokenSource(TimeSpan.FromMinutes(2));
            int msgCounter = 10;
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
                        var payloadNode = JsonNode.Parse(payloadStr);
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
                        var payloadNode = JsonNode.Parse(payloadStr);
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
                    else if (string.Equals(method, "FINISH_OK", StringComparison.OrdinalIgnoreCase) ||
                             string.Equals(method, "FINISH_CANCEL", StringComparison.OrdinalIgnoreCase))
                    {
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
                ws.Dispose();
            }
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




