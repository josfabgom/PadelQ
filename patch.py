import re

file_path = r"d:\Antigravity Proyectos\PadelQ\PadelQ.MobileApp\lib\presentation\pages\admin_dashboard_page.dart"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

start_idx = content.find("  Widget _buildHistoricalClosureDetailsView() {")
end_idx = content.find("  Widget _buildMethodMetricColumn(String label, double value) {")

if start_idx == -1 or end_idx == -1:
    print("Could not find boundaries")
    exit(1)

new_method = """  Widget _buildHistoricalClosureDetailsView() {
    if (_isLoadingClosureDetails || _selectedClosureDetails == null) {
      return const Center(child: CircularProgressIndicator(color: Colors.black));
    }

    final closure = _selectedClosureDetails!['closure'];
    final transactions = _selectedClosureDetails!['transactions'] as List<dynamic>? ?? [];

    final int id = closure['id'];
    final double expectedCash = (closure['expectedCash'] ?? 0.0).toDouble();
    final double actualCash = (closure['actualCash'] ?? 0.0).toDouble();
    final bool isOpen = closure['isOpen'] ?? false;

    Map<String, double> declaredTotals = {};
    if (closure['actualTotals'] != null) {
      try {
        final String rawJson = closure['actualTotals'].toString();
        final dynamic decoded = jsonDecode(rawJson);
        if (decoded is Map) {
          decoded.forEach((key, value) {
            declaredTotals[key.toString()] = (value ?? 0.0).toDouble();
          });
        }
      } catch (e) {
        print("Error parsing actualTotals: $e");
      }
    }

    // Calcular montos
    final Set<String> allMethods = transactions.map((t) => (t['method'] ?? '').toString()).toSet();
    final List<String> transferMethods = allMethods.where((m) => m.toLowerCase().contains('transferencia')).toList();
    final List<String> cardMethods = allMethods.where((m) => m.toLowerCase().contains('tarjeta')).toList();
    final List<String> otherMethods = allMethods.where((m) => !m.toLowerCase().contains('efectivo') && !m.toLowerCase().contains('transferencia') && !m.toLowerCase().contains('tarjeta')).toList();

    double getDeclaredOrExpected(String method) {
      if (declaredTotals.containsKey(method)) return declaredTotals[method]!;
      return transactions.where((t) => t['method'] == method).fold(0.0, (sum, t) => sum + (t['amount'] ?? 0.0).toDouble());
    }

    final double realTransfer = transferMethods.fold(0.0, (sum, m) => sum + getDeclaredOrExpected(m));
    final double realCard = cardMethods.fold(0.0, (sum, m) => sum + getDeclaredOrExpected(m));
    final double realOther = otherMethods.fold(0.0, (sum, m) => sum + getDeclaredOrExpected(m));

    final double totalGeneralDeclarado = actualCash + realTransfer + realCard + realOther;

    final double initialCash = (closure['initialCash'] ?? 0.0).toDouble();
    final double totalCashSales = (closure['totalCashSales'] ?? 0.0).toDouble();
    final double totalCashIn = (closure['totalCashIn'] ?? 0.0).toDouble();
    final double totalCashOut = (closure['totalCashOut'] ?? 0.0).toDouble();
    final double diff = actualCash - expectedCash;
    final bool hasDiff = !isOpen && diff.abs() > 0.01;

    // Group transactions by method
    final Map<String, List<Map<String, dynamic>>> groupedTransactions = {};
    for (var tx in transactions) {
      final String method = tx['method'] ?? 'No Especificado';
      if (!groupedTransactions.containsKey(method)) {
        groupedTransactions[method] = [];
      }
      groupedTransactions[method]!.add(tx as Map<String, dynamic>);
    }

    final List<Map<String, dynamic>> summaryList = [];
    groupedTransactions.forEach((method, txs) {
      final double total = txs.fold(0.0, (sum, tx) => sum + (tx['amount'] ?? 0.0).toDouble());
      summaryList.add({
        'method': method,
        'total': total,
        'count': txs.length,
        'color': _getMethodHexColor(method),
        'transactions': txs,
      });
    });
    summaryList.sort((a, b) => (b['total'] as double).compareTo(a['total'] as double));

    return RefreshIndicator(
      onRefresh: () => _loadClosureDetails(id),
      color: Colors.black,
      child: ListView(
        padding: EdgeInsets.all(24.w),
        children: [
          // Back Button
          GestureDetector(
            onTap: () {
              setState(() {
                _selectedClosureDetails = null;
              });
            },
            child: Row(
              children: [
                Icon(LucideIcons.arrowLeft, size: 14.sp, color: Colors.black),
                SizedBox(width: 8.w),
                Text(
                  'VOLVER AL HISTORIAL',
                  style: TextStyle(fontSize: 10.sp, fontWeight: FontWeight.w900, color: Colors.black, letterSpacing: 1.w),
                ),
              ],
            ),
          ),
          SizedBox(height: 16.h),

          // THE BLACK BANNER: TOTAL GENERAL DECLARADO
          Container(
            padding: EdgeInsets.all(24.w),
            decoration: BoxDecoration(
              color: Colors.black,
              borderRadius: BorderRadius.circular(24.r),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'TOTAL GENERAL DECLARADO',
                  style: TextStyle(fontSize: 10.sp, fontWeight: FontWeight.w900, color: Colors.grey.shade600, letterSpacing: 1.w),
                ),
                SizedBox(height: 4.h),
                Text(
                  '\\$${NumberFormat('#,##0.00', 'es_AR').format(totalGeneralDeclarado)}',
                  style: TextStyle(fontSize: 24.sp, fontWeight: FontWeight.w900, color: const Color(0xFF4ade80), fontStyle: FontStyle.italic),
                ),
                SizedBox(height: 24.h),
                Container(height: 1, color: Colors.white.withOpacity(0.1)),
                SizedBox(height: 24.h),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(child: _buildBannerStat('EFECTIVO', actualCash)),
                    Expanded(child: _buildBannerStat('TRANSFERENCIAS', realTransfer)),
                    Expanded(child: _buildBannerStat('TARJETAS', realCard)),
                    Expanded(child: _buildBannerStat('OTROS MEDIOS', realOther)),
                  ],
                ),
              ],
            ),
          ),
          
          SizedBox(height: 24.h),

          // 1. CONTROL FISICO DE EFECTIVO
          Container(
            padding: EdgeInsets.all(24.w),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(24.r),
              border: Border.all(color: Colors.black.withOpacity(0.05)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '1. CONTROL FÍSICO DE EFECTIVO',
                  style: TextStyle(fontSize: 11.sp, fontWeight: FontWeight.w900, color: Colors.black, letterSpacing: 1.w),
                ),
                SizedBox(height: 24.h),
                Row(
                  children: [
                    Expanded(child: _buildControlStat('FONDO INICIAL', initialCash, Colors.grey.shade50, Colors.black)),
                    SizedBox(width: 8.w),
                    Expanded(child: _buildControlStat('(+) VENTAS', totalCashSales, const Color(0xFFF0FDF4), const Color(0xFF166534))),
                  ],
                ),
                SizedBox(height: 8.h),
                Row(
                  children: [
                    Expanded(child: _buildControlStat('(+) INGRESOS', totalCashIn, Colors.blue.shade50, Colors.blue.shade800)),
                    SizedBox(width: 8.w),
                    Expanded(child: _buildControlStat('(-) EGRESOS', totalCashOut, Colors.red.shade50, Colors.red.shade800)),
                  ],
                ),
                SizedBox(height: 16.h),
                Container(
                  padding: EdgeInsets.symmetric(horizontal: 20.w, vertical: 16.h),
                  decoration: BoxDecoration(
                    color: Colors.black,
                    borderRadius: BorderRadius.circular(16.r),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('ESPERADO (SISTEMA)', style: TextStyle(fontSize: 8.sp, fontWeight: FontWeight.w900, color: Colors.grey.shade600, letterSpacing: 1.w)),
                          SizedBox(height: 4.h),
                          Text('\\$${NumberFormat('#,##0.00', 'es_AR').format(expectedCash)}', style: TextStyle(fontSize: 14.sp, fontWeight: FontWeight.w900, color: Colors.white, fontStyle: FontStyle.italic)),
                        ],
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text('REAL DECLARADO', style: TextStyle(fontSize: 8.sp, fontWeight: FontWeight.w900, color: Colors.grey.shade600, letterSpacing: 1.w)),
                          SizedBox(height: 4.h),
                          Text('\\$${NumberFormat('#,##0.00', 'es_AR').format(actualCash)}', style: TextStyle(fontSize: 14.sp, fontWeight: FontWeight.w900, color: Colors.white, fontStyle: FontStyle.italic)),
                        ],
                      ),
                    ],
                  ),
                ),
                if (hasDiff) ...[
                  SizedBox(height: 16.h),
                  Container(
                    width: double.infinity,
                    padding: EdgeInsets.symmetric(vertical: 16.h),
                    decoration: BoxDecoration(
                      color: diff < 0 ? const Color(0xFFFEF2F2) : const Color(0xFFDCFCE7),
                      borderRadius: BorderRadius.circular(16.r),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Text(
                          diff < 0 ? 'DIFERENCIA: FALTANTE' : 'DIFERENCIA: SOBRANTE',
                          style: TextStyle(fontSize: 8.sp, fontWeight: FontWeight.w900, color: diff < 0 ? const Color(0xFF991B1B) : const Color(0xFF166534), letterSpacing: 1.w),
                        ),
                        SizedBox(height: 4.h),
                        Text(
                          '\\$${NumberFormat('#,##0.00', 'es_AR').format(diff.abs())}',
                          style: TextStyle(fontSize: 14.sp, fontWeight: FontWeight.w900, color: diff < 0 ? const Color(0xFF991B1B) : const Color(0xFF166534), fontStyle: FontStyle.italic),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),

          SizedBox(height: 24.h),

          // 2. OTROS MEDIOS DE PAGO
          Container(
            padding: EdgeInsets.all(24.w),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(24.r),
              border: Border.all(color: Colors.black.withOpacity(0.05)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '2. OTROS MEDIOS DE PAGO',
                  style: TextStyle(fontSize: 11.sp, fontWeight: FontWeight.w900, color: Colors.black, letterSpacing: 1.w),
                ),
                SizedBox(height: 24.h),
                if (otherMethods.isEmpty && transferMethods.isEmpty && cardMethods.isEmpty)
                  Text('No hay movimientos en otros medios.', style: TextStyle(fontSize: 10.sp, fontStyle: FontStyle.italic, color: Colors.grey.shade500, fontWeight: FontWeight.bold))
                else
                  ...summaryList.where((s) => !s['method'].toString().toLowerCase().contains('efectivo')).map((s) {
                    final String method = s['method'] ?? '';
                    final double expected = (s['total'] ?? 0.0).toDouble();
                    final double actual = getDeclaredOrExpected(method);
                    final double mDiff = actual - expected;

                    return Container(
                      margin: EdgeInsets.only(bottom: 12.h),
                      padding: EdgeInsets.all(16.w),
                      decoration: BoxDecoration(
                        color: Colors.grey.shade50,
                        borderRadius: BorderRadius.circular(16.r),
                        border: Border.all(color: Colors.black.withOpacity(0.05)),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(method.toUpperCase(), style: TextStyle(fontSize: 12.sp, fontWeight: FontWeight.w900, color: Colors.black)),
                              SizedBox(height: 4.h),
                              Text('ESPERADO: \\$${NumberFormat('#,##0.00', 'es_AR').format(expected)}', style: TextStyle(fontSize: 8.sp, fontWeight: FontWeight.w900, color: Colors.grey.shade400, letterSpacing: 0.5.w)),
                            ],
                          ),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text('\\$${NumberFormat('#,##0.00', 'es_AR').format(actual)}', style: TextStyle(fontSize: 14.sp, fontWeight: FontWeight.w900, color: Colors.black, fontStyle: FontStyle.italic)),
                              if (mDiff.abs() > 0.01)
                                Text(
                                  'DIF: ${mDiff > 0 ? '+' : ''}\\$${NumberFormat('#,##0.00', 'es_AR').format(mDiff)}',
                                  style: TextStyle(fontSize: 8.sp, fontWeight: FontWeight.w900, color: mDiff > 0 ? Colors.green.shade700 : Colors.red.shade700),
                                ),
                            ],
                          ),
                        ],
                      ),
                    );
                  }).toList(),
              ],
            ),
          ),

          SizedBox(height: 24.h),

          // 3. DESGLOSE DE MOVIMIENTOS
          Container(
            padding: EdgeInsets.all(24.w),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(24.r),
              border: Border.all(color: Colors.black.withOpacity(0.05)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '3. DESGLOSE DE MOVIMIENTOS',
                  style: TextStyle(fontSize: 11.sp, fontWeight: FontWeight.w900, color: Colors.black, letterSpacing: 1.w),
                ),
                SizedBox(height: 24.h),
                if (transactions.isEmpty)
                  Text('No hay transacciones registradas en esta caja.', style: TextStyle(fontSize: 10.sp, fontStyle: FontStyle.italic, color: Colors.grey.shade500, fontWeight: FontWeight.bold))
                else
                  ...transactions.map((tx) {
                    final double amount = (tx['amount'] ?? 0.0).toDouble();
                    final String description = tx['description'] ?? 'Sin concepto';
                    final String userName = tx['userName'] ?? 'Particular';
                    final String method = tx['method'] ?? 'Efectivo';
                    final String time = tx['date'] != null ? DateFormat('HH:mm').format(DateTime.parse(tx['date']).toLocal()) : '--:--';
                    final bool isEgreso = amount < 0;

                    return Container(
                      margin: EdgeInsets.only(bottom: 12.h),
                      padding: EdgeInsets.all(16.w),
                      decoration: BoxDecoration(
                        color: Colors.grey.shade50,
                        borderRadius: BorderRadius.circular(16.r),
                        border: Border.all(color: Colors.black.withOpacity(0.05)),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Container(
                                      padding: EdgeInsets.symmetric(horizontal: 6.w, vertical: 2.h),
                                      decoration: BoxDecoration(
                                        color: isEgreso ? Colors.red.shade50 : Colors.green.shade50,
                                        borderRadius: BorderRadius.circular(4.r),
                                      ),
                                      child: Text(
                                        isEgreso ? 'EGRESO' : 'INGRESO',
                                        style: TextStyle(fontSize: 7.sp, fontWeight: FontWeight.w900, color: isEgreso ? Colors.red.shade700 : Colors.green.shade700, letterSpacing: 0.5.w),
                                      ),
                                    ),
                                    SizedBox(width: 6.w),
                                    Text(method.toUpperCase(), style: TextStyle(fontSize: 8.sp, fontWeight: FontWeight.w900, color: Colors.black, letterSpacing: 0.5.w)),
                                  ],
                                ),
                                SizedBox(height: 6.h),
                                Text(description, style: TextStyle(fontSize: 10.sp, fontWeight: FontWeight.w700, color: Colors.grey.shade700), maxLines: 2, overflow: TextOverflow.ellipsis),
                                SizedBox(height: 4.h),
                                Text('$time hs • $userName', style: TextStyle(fontSize: 8.sp, fontWeight: FontWeight.w900, color: Colors.grey.shade400, letterSpacing: 0.5.w)),
                              ],
                            ),
                          ),
                          SizedBox(width: 12.w),
                          Text(
                            '\\$${NumberFormat('#,##0.00', 'es_AR').format(amount)}',
                            style: TextStyle(fontSize: 14.sp, fontWeight: FontWeight.w900, color: isEgreso ? Colors.red.shade600 : Colors.black, fontStyle: FontStyle.italic),
                          ),
                        ],
                      ),
                    );
                  }).toList(),
              ],
            ),
          ),
          
          SizedBox(height: 32.h),
        ],
      ),
    );
  }

  Widget _buildBannerStat(String label, double value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: TextStyle(fontSize: 7.sp, fontWeight: FontWeight.w900, color: Colors.grey.shade500, letterSpacing: 0.5.w)),
        SizedBox(height: 4.h),
        Text('\\$${NumberFormat('#,##0.00', 'es_AR').format(value)}', style: TextStyle(fontSize: 11.sp, fontWeight: FontWeight.w900, color: Colors.white, fontStyle: FontStyle.italic)),
      ],
    );
  }

  Widget _buildControlStat(String label, double value, Color bgColor, Color textColor) {
    return Container(
      padding: EdgeInsets.all(16.w),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(16.r),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: TextStyle(fontSize: 8.sp, fontWeight: FontWeight.w900, color: textColor.withOpacity(0.5), letterSpacing: 0.5.w)),
          SizedBox(height: 4.h),
          Text('\\$${NumberFormat('#,##0.00', 'es_AR').format(value)}', style: TextStyle(fontSize: 12.sp, fontWeight: FontWeight.w900, color: textColor, fontStyle: FontStyle.italic)),
        ],
      ),
    );
  }
"""

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content[:start_idx] + new_method + content[end_idx:])
print("Replaced!")
