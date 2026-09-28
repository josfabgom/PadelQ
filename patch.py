import sys

with open('PadelQ.API/Controllers/MercadoPagoController.cs', 'r', encoding='utf-8') as f:
    content = f.read()

orig1 = '''if (actualReference.Length > 2)
                    {
                        var bookingIdStr = actualReference.Substring(2);
                        var key = $\"MP_Alloc_{bookingIdStr}\";'''

repl1 = '''if (actualReference.Length > 2)
                    {
                        var bookingIdStr = actualReference.Substring(2);
                        string allocKeySuffix = bookingIdStr;
                        if (bookingIdStr.Contains(\"@\"))
                        {
                            allocKeySuffix = bookingIdStr.Split('@')[1];
                        }
                        var key = $\"MP_Alloc_{allocKeySuffix}\";'''

content = content.replace(orig1, repl1)

orig2 = '''            string bookingIdStr = \"\";
            if (referenceId.StartsWith(\"B-\") || referenceId.StartsWith(\"S-\") || referenceId.StartsWith(\"D-\"))
            {
                bookingIdStr = referenceId.Substring(2);
            }

            var allocKey = $\"MP_Alloc_{bookingIdStr}\";'''

repl2 = '''            string bookingIdStr = \"\";
            string allocIdStr = \"\";
            if (referenceId.StartsWith(\"B-\") || referenceId.StartsWith(\"S-\") || referenceId.StartsWith(\"D-\"))
            {
                var refPart = referenceId.Substring(2);
                if (refPart.Contains(\"@\"))
                {
                    var split = refPart.Split('@');
                    bookingIdStr = split[0];
                    allocIdStr = split[1];
                }
                else
                {
                    bookingIdStr = refPart;
                }
            }

            var allocKey = !string.IsNullOrEmpty(allocIdStr) ? $\"MP_Alloc_{allocIdStr}\" : $\"MP_Alloc_{bookingIdStr}\";'''

content = content.replace(orig2, repl2)

orig3 = '''                    decimal previousDebt = 0;
                    if (root.TryGetProperty(\"PreviousDebt\", out var prevDebtProp) || root.TryGetProperty(\"previousDebt\", out prevDebtProp))
                    {
                        if (prevDebtProp.ValueKind == JsonValueKind.Number)
                            previousDebt = prevDebtProp.GetDecimal();
                    }

                    // 1. Aplicar pagos a rentas (canchas o espacios)'''

repl3 = '''                    decimal previousDebt = 0;
                    if (root.TryGetProperty(\"PreviousDebt\", out var prevDebtProp) || root.TryGetProperty(\"previousDebt\", out prevDebtProp))
                    {
                        if (prevDebtProp.ValueKind == JsonValueKind.Number)
                            previousDebt = prevDebtProp.GetDecimal();
                    }

                    decimal totalAllocated = previousDebt;
                    foreach (var r in rentAllocations) totalAllocated += r.Amount;
                    foreach (var c in consumptionAllocations) totalAllocated += c.Amount;

                    if (amount < totalAllocated)
                    {
                        throw new Exception($\"El pago de Mercado Pago ({amount}) es menor que el total asignado ({totalAllocated}). No se proceso por seguridad.\");
                    }

                    if (amount > totalAllocated)
                    {
                        var remainingAmount = amount - totalAllocated;
                        var userId = await GetOrCreateParticularUserIdAsync();
                        _context.Transactions.Add(new Transaction
                        {
                            Amount = remainingAmount,
                            Type = TransactionType.CashIn,
                            Date = TimeZoneHelper.GetArgNow(),
                            Description = $\"Pago por QR Mercado Pago (ID: {mpPaymentId}) - Excedente no asignado\",
                            UserId = userId,
                            PaymentMethodId = mpMethod?.Id,
                            ProcessedBy = processedBy,
                            PaymentGroupId = paymentGroupId
                        });
                    }

                    // 1. Aplicar pagos a rentas (canchas o espacios)'''

content = content.replace(orig3, repl3)

with open('PadelQ.API/Controllers/MercadoPagoController.cs', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done!')
