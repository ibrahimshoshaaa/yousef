import 'package:flutter/material.dart';
import 'package:uuid/uuid.dart';

import 'api.dart';
import 'more.dart';
import 'ui.dart';

const orderStages = {'NEW': 'قيد التجهيز', 'PREPARED': 'تم التجهيز',
  'SHIPPING': 'جاري الشحن', 'DELIVERED': 'تم التسليم', 'RETURNED': 'تم الإرجاع'};
const paymentStages = {'PAID': 'مدفوع', 'PARTIALLY_PAID': 'مدفوع جزئيًا',
  'PENDING': 'غير مدفوع', 'REFUNDED': 'مسترد', 'PARTIALLY_REFUNDED': 'مسترد جزئيًا'};
const fulfillmentStages = {'UNFULFILLED': 'لم يُشحن', 'FULFILLED': 'تم الشحن',
  'PARTIALLY_FULFILLED': 'شُحن جزء منه', 'IN_PROGRESS': 'جاري التجهيز'};

class OrdersPage extends StatefulWidget {
  const OrdersPage({required this.api, required this.canWrite, super.key});
  final ErpApi api;
  final bool canWrite;
  @override
  State<OrdersPage> createState() => _OrdersPageState();
}

class _OrdersPageState extends State<OrdersPage> {
  final search = TextEditingController();
  int page = 1;
  late Future<dynamic> result = load();
  Future<dynamic> load() => widget.api.get('/api/mobile/orders?page=$page&search=${Uri.encodeQueryComponent(search.text)}');
  void reload() => setState(() => result = load());
  @override
  void dispose() { search.dispose(); super.dispose(); }

  Future<void> newOrder() async {
    final created = await openPage<bool>(context, NewOrderPage(api: widget.api));
    if (created == true) reload();
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<dynamic>(future: result, builder: (context, snapshot) {
    if (!snapshot.hasData && !snapshot.hasError) return const PageSkeleton();
    final body = <Widget>[
      const PageIntro(title: 'الطلبات',
        subtitle: 'تابع التجهيز والشحن والتحصيل', icon: Icons.receipt_long_outlined),
      const SizedBox(height: 20),
      if (widget.canWrite) ...[
        SizedBox(width: double.infinity, height: 52,
          child: FilledButton.icon(onPressed: newOrder,
            icon: const Icon(Icons.add_circle_outline, size: 22),
            label: const Text('طلب جديد'))),
        const SizedBox(height: 18),
      ],
      TextField(controller: search, textInputAction: TextInputAction.search,
        onSubmitted: (_) { page = 1; reload(); },
        decoration: InputDecoration(hintText: 'ابحث برقم الطلب أو اسم العميل',
          prefixIcon: const Icon(Icons.search),
          suffixIcon: IconButton(tooltip: 'بحث',
            onPressed: () { page = 1; reload(); }, icon: const Icon(Icons.arrow_back)))),
      const SizedBox(height: 22),
    ];
    if (snapshot.hasError) body.add(TextButton(onPressed: reload, child: Text('إعادة المحاولة: ${snapshot.error}')));
    if (snapshot.hasData) {
      final data = snapshot.data as Map;
      final orders = (data['data'] as List).map(json);
      body.add(Padding(padding: const EdgeInsets.only(bottom: 14),
        child: Row(children: [
          const Expanded(child: Text('سجل الطلبات', style: TextStyle(
            fontSize: 18, fontWeight: FontWeight.w800, color: Color(0xff193443)))),
          Text('${data['count']} طلب', style: const TextStyle(color: Color(0xff718089))),
        ])));
      if (orders.isEmpty) body.add(const Padding(padding: EdgeInsets.all(32),
        child: Center(child: Text('لا توجد طلبات بهذا البحث'))));
      body.addAll(orders.map((o) {
        final stage = orderStages[str(o['manualStatus'])] ??
          orderStages[str(o['shopifyStage'])] ??
          fulfillmentStages[str(o['fulfillmentStatus'])] ?? str(o['fulfillmentStatus']);
        final isReturned = o['manualStatus'] == 'RETURNED';
        final isDelivered = o['manualStatus'] == 'DELIVERED' || o['shopifyStage'] == 'DELIVERED';
        final badgeColor = isReturned ? const Color(0xfffbebed) :
          isDelivered ? const Color(0xffe4f3e9) : const Color(0xfffff3dc);
        final badgeText = isReturned ? const Color(0xffa33146) :
          isDelivered ? const Color(0xff24704a) : const Color(0xff8c682c);
        final number = str(o['orderNumber']).replaceFirst(RegExp(r'^#+'), '');
        final currency = str(o['currency']);
        final customer = str(o['customerRef']).trim();
        final items = (o['items'] as List).map(json).toList();
        return Padding(padding: const EdgeInsets.only(bottom: 14),
          child: Card(clipBehavior: Clip.antiAlias, child: ExpansionTile(
        tilePadding: const EdgeInsets.fromLTRB(18, 12, 18, 12),
        childrenPadding: const EdgeInsets.fromLTRB(18, 0, 18, 18),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        collapsedShape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: Text('طلب #$number', textDirection: TextDirection.rtl,
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800,
                color: Color(0xff193443)))),
            Container(padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
            decoration: BoxDecoration(color: badgeColor,
              borderRadius: BorderRadius.circular(30)),
              child: Text(stage, style: TextStyle(fontSize: 12,
                color: badgeText, fontWeight: FontWeight.w700))),
          ]),
          const SizedBox(height: 12),
          Text(customer.isEmpty ? 'عميل غير محدد' : customer,
              maxLines: 1, overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: Color(0xff65747d), fontSize: 14)),
          const SizedBox(height: 12),
          Row(children: [
            Text('${str(o['total'])} $currency', style: const TextStyle(
              fontSize: 16, fontWeight: FontWeight.w800, color: Color(0xff143e54))),
            const SizedBox(width: 10),
            Text('· ${items.length} صنف', style: const TextStyle(
              fontSize: 13, color: Color(0xff718089))),
          ]),
        ]),
        children: [
          const Divider(height: 24),
          _detailRow(Icons.storefront_outlined, 'المصدر',
            o['manualStatus'] == null ? 'Shopify' : 'طلب يدوي'),
          _detailRow(Icons.payments_outlined, 'الدفع',
            paymentStages[str(o['financialStatus'])] ?? str(o['financialStatus'])),
          if (str(o['depositAmount']).isNotEmpty)
            _detailRow(Icons.account_balance_wallet_outlined, 'الديبوزت',
              '${str(o['depositAmount'])} $currency'),
          const SizedBox(height: 14),
          _sectionTitle('بيانات العميل'),
          _detailRow(Icons.person_outline, 'الاسم', customer.isEmpty ? 'غير متاح' : customer),
          if (str(o['customerPhone']).trim().isNotEmpty)
            _detailRow(Icons.phone_outlined, 'الهاتف', str(o['customerPhone'])),
          if (str(o['customerAddress']).trim().isNotEmpty)
            _detailRow(Icons.location_on_outlined, 'العنوان', str(o['customerAddress'])),
          const SizedBox(height: 14),
          _sectionTitle('الأصناف (${items.length})'),
          ...items.map((item) => Padding(padding: const EdgeInsets.symmetric(vertical: 7),
            child: Row(children: [
              Expanded(child: Text(str(item['title']), style: const TextStyle(
                fontWeight: FontWeight.w600))),
              Text('× ${str(item['quantity'])}', style: const TextStyle(
                fontWeight: FontWeight.w800, color: Color(0xff143e54))),
            ]))),
          const SizedBox(height: 12),
          SizedBox(width: double.infinity, child: OutlinedButton.icon(
            onPressed: () => openPage(context, Scaffold(
            appBar: AppBar(title: Text('استهلاك طلب #${str(o['orderNumber'])}')),
            body: ConsumptionPage(api: widget.api, orderId: str(o['id'])))),
            icon: const Icon(Icons.science_outlined),
            label: const Text('عرض حركة استهلاك الخامات'))),
          if (widget.canWrite) const SizedBox(height: 10),
          if (widget.canWrite && o['manualStatus'] != null) ...[
            if (o['manualStatus'] == 'NEW') action(o, 'PREPARED', 'تم التجهيز وخصم الخامات'),
            if (o['manualStatus'] == 'PREPARED') action(o, 'SHIPPING', 'جاري الشحن'),
            if (o['manualStatus'] == 'SHIPPING') ...[
              action(o, 'DELIVERED', 'تم التسليم وتحصيل المبلغ'),
              action(o, 'RETURNED', 'تم الإرجاع وإعادة الخامات', destructive: true),
            ],
          ],
          if (widget.canWrite && o['shopifyId'] != null) ...[
            if (o['shopifyStage'] == null && o['fulfillmentStatus'] == 'UNFULFILLED')
              shopifyAction(o, 'PREPARED', 'تم التجهيز'),
            if (o['shopifyStage'] == 'PREPARED')
              shopifyAction(o, 'SHIPPING', 'تم الشحن في Shopify'),
            if (o['shopifyStage'] == 'SHIPPING')
              shopifyAction(o, 'DELIVERED', 'تم التسليم في Shopify'),
          ],
        ],
      )));
      }));
      body.add(Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        TextButton(onPressed: page <= 1 ? null : () { page--; reload(); }, child: const Text('السابق')),
        Text('صفحة $page · ${data['count']} طلب'),
        TextButton(onPressed: data['hasMore'] == true ? () { page++; reload(); } : null,
          child: const Text('التالي')),
      ]));
    }
    return RefreshIndicator(onRefresh: () async { reload(); await result; },
      child: ListView(padding: const EdgeInsets.fromLTRB(16, 16, 16, 24), children: body));
  });

  Widget _sectionTitle(String title) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: Align(alignment: AlignmentDirectional.centerStart,
      child: Text(title, style: const TextStyle(fontSize: 15,
        fontWeight: FontWeight.w800, color: Color(0xff193443)))));

  Widget _detailRow(IconData icon, String label, String value) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 6),
    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Icon(icon, size: 19, color: const Color(0xff638095)),
      const SizedBox(width: 8),
      Text('$label: ', style: const TextStyle(color: Color(0xff718089))),
      Expanded(child: Text(value, style: const TextStyle(fontWeight: FontWeight.w600))),
    ]));

  Widget action(Json order, String status, String label, {bool destructive = false}) =>
    ListTile(leading: Icon(destructive ? Icons.undo : Icons.check_circle_outline),
      title: Text(label), onTap: () async {
        if (!await confirm(context, destructive
          ? 'ستُعاد الخامات للمخزون وتُسجل تكلفة المرتجع. لا يمكن التراجع عن العملية.'
          : 'تحديث حالة الطلب إلى «$label»؟')) return;
        try {
          await perform(context, () => widget.api.post(
            '/api/orders/${Uri.encodeComponent(str(order['id']))}/manual-status', {'status': status}));
          reload();
        } catch (_) { /* The shared helper displays the server error. */ }
      });

  Widget shopifyAction(Json order, String status, String label) =>
    ListTile(leading: const Icon(Icons.local_shipping_outlined), title: Text(label), onTap: () async {
      if (!await confirm(context, status == 'PREPARED'
        ? 'تأكيد تجهيز الطلب؟'
        : 'سيتم تحديث حالة الطلب في Shopify أيضًا. تأكيد «$label»؟')) return;
      try {
        await perform(context, () => widget.api.post(
          '/api/orders/${Uri.encodeComponent(str(order['id']))}/shopify-status', {'status': status}));
        reload();
      } catch (_) { /* The shared helper displays the server error. */ }
    });
}

class NewOrderPage extends StatefulWidget {
  const NewOrderPage({required this.api, super.key});
  final ErpApi api;
  @override
  State<NewOrderPage> createState() => _NewOrderPageState();
}

class _OrderLine {
  String? variantId;
  final quantity = TextEditingController(text: '1');
  final price = TextEditingController();
  void dispose() { quantity.dispose(); price.dispose(); }
}

class _NewOrderPageState extends State<NewOrderPage> {
  final name = TextEditingController();
  final phone = TextEditingController();
  final address = TextEditingController();
  final deposit = TextEditingController();
  final lines = <_OrderLine>[_OrderLine()];
  late final String requestId = const Uuid().v4();
  late Future<List<Json>> variants = loadVariants();
  Future<List<Json>> loadVariants() async => rows(await widget.api.get('/api/mobile/catalog'));
  bool hasDeposit = false;
  bool busy = false;

  @override
  void dispose() {
    name.dispose(); phone.dispose(); address.dispose(); deposit.dispose();
    for (final line in lines) { line.dispose(); }
    super.dispose();
  }

  Future<void> submit() async {
    final total = lines.fold<double>(0, (sum, line) =>
      sum + (int.tryParse(line.quantity.text) ?? 0) * (double.tryParse(line.price.text) ?? 0));
    final depositValue = hasDeposit ? double.tryParse(deposit.text) : 0.0;
    if (name.text.trim().length < 2 || phone.text.trim().length < 7 ||
        address.text.trim().length < 5 || total <= 0 || depositValue == null ||
        depositValue < 0 || depositValue >= total ||
        (hasDeposit && depositValue == 0) ||
        lines.any((line) => line.variantId == null ||
          (int.tryParse(line.quantity.text) ?? 0) < 1 ||
          double.tryParse(line.price.text) == null ||
          (double.tryParse(line.price.text) ?? -1) < 0) ||
        lines.map((line) => line.variantId).toSet().length != lines.length) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('راجع بيانات العميل والأصناف والسعر والديبوزت')));
      return;
    }
    setState(() => busy = true);
    try {
      await perform(context, () => widget.api.post('/api/orders/manual', {
        'requestId': requestId, 'customerName': name.text.trim(),
        'customerPhone': phone.text.trim(), 'customerAddress': address.text.trim(),
        'hasDeposit': hasDeposit, 'depositAmount': depositValue,
        'items': lines.map((line) => {'variantId': line.variantId,
          'quantity': int.parse(line.quantity.text), 'unitPrice': double.parse(line.price.text)}).toList(),
      }), success: 'تم تسجيل الطلب');
      if (mounted) Navigator.pop(context, true);
    } catch (_) { /* The shared helper displays the server error. */ }
    finally { if (mounted) setState(() => busy = false); }
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<List<Json>>(
    future: variants, builder: (context, snapshot) => Scaffold(
      appBar: AppBar(title: const Text('طلب جديد')),
      body: ListView(padding: const EdgeInsets.fromLTRB(16, 20, 16, 28), children: [
        const PageIntro(title: 'تسجيل طلب جديد',
          subtitle: 'أضف الأصناف وبيانات العميل ثم راجع الإجمالي',
          icon: Icons.add_shopping_cart_outlined),
        const SizedBox(height: 24),
        _formCard('١  الأصناف', 'اختر المنتج والحجم، ثم حدد العدد والسعر.', [
          if (!snapshot.hasData && !snapshot.hasError)
            const LinearProgressIndicator(),
          if (snapshot.hasError)
            TextButton.icon(onPressed: () => setState(() => variants = loadVariants()),
              icon: const Icon(Icons.refresh), label: const Text('تعذر تحميل المنتجات، حاول مجددًا')),
          if (snapshot.hasData) ...[
            if (snapshot.data!.isEmpty)
              const Padding(padding: EdgeInsets.only(bottom: 12),
                child: Text('لا توجد منتجات متاحة لإضافتها للطلب.')),
            for (var i = 0; i < lines.length; i++) ...[
              if (i > 0) const Divider(height: 32),
              Row(children: [
                Expanded(child: Text('الصنف ${i + 1}', style: const TextStyle(
                  fontWeight: FontWeight.w800, color: appInk))),
                if (lines.length > 1) IconButton(
                  tooltip: 'إزالة الصنف', icon: const Icon(Icons.delete_outline),
                  onPressed: () => setState(() => lines.removeAt(i).dispose())),
              ]),
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(value: lines[i].variantId,
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'المنتج والحجم',
                  prefixIcon: Icon(Icons.inventory_2_outlined)),
                items: snapshot.data!.map((v) => DropdownMenuItem<String>(
                  value: str(v['id']), child: Text(str(v['title']),
                    maxLines: 1, overflow: TextOverflow.ellipsis))).toList(),
                onChanged: (id) { final v = snapshot.data!.firstWhere((v) => v['id'] == id);
                  setState(() { lines[i].variantId = id; lines[i].price.text = str(v['price']); }); }),
              const SizedBox(height: 14),
              Row(children: [
                Expanded(child: field('العدد', lines[i].quantity, type: TextInputType.number)),
                const SizedBox(width: 12),
                Expanded(child: field('سعر القطعة', lines[i].price,
                  type: const TextInputType.numberWithOptions(decimal: true))),
              ]),
            ],
            const SizedBox(height: 4),
            SizedBox(width: double.infinity, child: OutlinedButton.icon(
              onPressed: lines.length >= 30 || snapshot.data!.isEmpty ? null :
                () => setState(() => lines.add(_OrderLine())),
              icon: const Icon(Icons.add), label: const Text('إضافة صنف آخر'))),
          ],
        ]),
        const SizedBox(height: 16),
        _formCard('٢  بيانات العميل', 'بيانات التواصل وعنوان التوصيل.', [
          field('اسم العميل', name),
          field('رقم الهاتف', phone, type: TextInputType.phone),
          field('عنوان التوصيل', address, lines: 2),
        ]),
        const SizedBox(height: 16),
        _formCard('٣  التحصيل', 'الديبوزت يُسجّل فور استلامه.', [
          SwitchListTile.adaptive(contentPadding: EdgeInsets.zero,
            value: hasDeposit, onChanged: (value) => setState(() => hasDeposit = value),
            title: const Text('العميل دفع ديبوزت'),
            subtitle: const Text('اتركه مغلقًا إذا لم تستلم دفعة مقدمة')),
          if (hasDeposit) ...[
            const SizedBox(height: 12),
            field('قيمة الديبوزت (EGP)', deposit,
              type: const TextInputType.numberWithOptions(decimal: true)),
          ],
        ]),
        const SizedBox(height: 16),
        AnimatedBuilder(animation: Listenable.merge([
          deposit, ...lines.expand((line) => [line.quantity, line.price]),
        ]), builder: (context, _) {
          final total = lines.fold<double>(0, (sum, line) => sum +
            (int.tryParse(line.quantity.text) ?? 0) * (double.tryParse(line.price.text) ?? 0));
          final paid = hasDeposit ? (double.tryParse(deposit.text) ?? 0) : 0.0;
          return Container(padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(color: appNavy,
              borderRadius: BorderRadius.circular(22)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              const Text('ملخص الطلب', style: TextStyle(color: Colors.white,
                fontSize: 18, fontWeight: FontWeight.w800)),
              const SizedBox(height: 16),
              _totalRow('الإجمالي', total),
              _totalRow('الديبوزت المستلم', paid),
              const Divider(height: 24, color: Colors.white38),
              _totalRow('المتبقي عند التسليم', total - paid, emphasized: true),
            ]));
        }),
      ]),
      bottomNavigationBar: SafeArea(top: false, child: Container(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
        decoration: const BoxDecoration(color: Colors.white,
          border: Border(top: BorderSide(color: Color(0xffe5eae6)))),
        child: SizedBox(height: 52, child: FilledButton.icon(
          onPressed: busy || !snapshot.hasData || snapshot.data!.isEmpty ? null : submit,
          icon: busy ? const SizedBox(width: 18, height: 18,
            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) :
            const Icon(Icons.check_circle_outline),
          label: Text(busy ? 'جارٍ حفظ الطلب' : 'تسجيل الطلب'))))),
    ));

  Widget _formCard(String title, String subtitle, List<Widget> children) =>
    Card(margin: EdgeInsets.zero, child: Padding(
      padding: const EdgeInsets.all(18),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text(title, style: const TextStyle(fontSize: 17,
          fontWeight: FontWeight.w800, color: appInk)),
        const SizedBox(height: 4),
        Text(subtitle, style: const TextStyle(fontSize: 12, color: appMuted)),
        const SizedBox(height: 20),
        ...children,
      ])));

  Widget _totalRow(String label, double value, {bool emphasized = false}) =>
    Padding(padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(children: [
        Expanded(child: Text(label, style: TextStyle(
          color: emphasized ? Colors.white : Colors.white70,
          fontWeight: emphasized ? FontWeight.w700 : FontWeight.normal))),
        Text('${value.toStringAsFixed(2)} EGP',
          style: TextStyle(color: Colors.white,
            fontSize: emphasized ? 17 : 14,
            fontWeight: FontWeight.w800)),
      ]));
}
