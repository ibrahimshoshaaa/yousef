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
      Row(children: [
        const Expanded(child: PageIntro(title: 'الطلبات',
          subtitle: 'تابع التجهيز والشحن والتحصيل', icon: Icons.receipt_long_outlined)),
        if (widget.canWrite) FilledButton.icon(onPressed: newOrder,
          icon: const Icon(Icons.add, size: 19), label: const Text('طلب جديد')),
      ]),
      const SizedBox(height: 18),
      TextField(controller: search,
        onSubmitted: (_) { page = 1; reload(); },
        decoration: InputDecoration(hintText: 'رقم الطلب أو اسم العميل',
          prefixIcon: const Icon(Icons.search),
          suffixIcon: IconButton(tooltip: 'بحث',
            onPressed: () { page = 1; reload(); }, icon: const Icon(Icons.arrow_back)))),
      const SizedBox(height: 14),
    ];
    if (snapshot.hasError) body.add(TextButton(onPressed: reload, child: Text('إعادة المحاولة: ${snapshot.error}')));
    if (snapshot.hasData) {
      final data = snapshot.data as Map;
      final orders = (data['data'] as List).map(json);
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
        return Padding(padding: const EdgeInsets.only(bottom: 10),
          child: Card(child: ExpansionTile(
        tilePadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 7),
        childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        collapsedShape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(children: [
          Expanded(child: Text('طلب #$number', textDirection: TextDirection.rtl,
            style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800))),
          Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(color: badgeColor,
              borderRadius: BorderRadius.circular(30)),
            child: Text(stage, style: TextStyle(fontSize: 11,
              color: badgeText, fontWeight: FontWeight.w700))),
        ]),
        subtitle: Padding(padding: const EdgeInsets.only(top: 8),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(str(o['customerRef']).isEmpty ? 'عميل غير محدد' : str(o['customerRef']),
              maxLines: 1, overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: Color(0xff65746c), fontSize: 13)),
            const SizedBox(height: 5),
            Text('${str(o['total'])} ${str(o['currency'])} · ${(o['items'] as List).length} صنف',
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700,
                color: Color(0xff173d34))),
          ])),
        children: [
          const Divider(),
          ListTile(title: Text(o['manualStatus'] == null ? 'طلب Shopify' : 'طلب يدوي'),
            subtitle: Text('الدفع: ${paymentStages[str(o['financialStatus'])] ?? str(o['financialStatus'])}')),
          ListTile(title: const Text('بيانات العميل'), subtitle: Text('${str(o['customerRef'])}\n${str(o['customerPhone'])}\n${str(o['customerAddress'])}')),
          ListTile(title: const Text('الديبوزت'), subtitle: Text('${str(o['depositAmount'])} ${str(o['currency'])}')),
          ...((o['items'] as List).map(json)).map((item) => ListTile(
            title: Text(str(item['title'])),
            subtitle: Text('العدد: ${str(item['quantity'])} · ${str(item['consumptionStatus'])}'))),
          TextButton(onPressed: () => openPage(context, Scaffold(
            appBar: AppBar(title: Text('استهلاك طلب #${str(o['orderNumber'])}')),
            body: ConsumptionPage(api: widget.api, orderId: str(o['id'])))),
            child: const Text('عرض حركة استهلاك الخامات')),
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
    future: variants, builder: (context, snapshot) => FormScaffold(
      title: 'إضافة طلب', busy: busy, onSubmit: submit,
      children: [
        const FormSection(title: 'الأصناف', subtitle: 'اختر المنتج والعدد والسعر لكل صنف.'),
        if (!snapshot.hasData && !snapshot.hasError) const LinearProgressIndicator(),
        if (snapshot.hasError) Text('تعذر تحميل المنتجات: ${snapshot.error}'),
        if (snapshot.hasData) ...[
          for (var i = 0; i < lines.length; i++) Card(child: Padding(
            padding: const EdgeInsets.all(12), child: Column(children: [
              DropdownButtonFormField<String>(value: lines[i].variantId,
                decoration: const InputDecoration(labelText: 'المنتج والحجم'),
                items: snapshot.data!.map((v) => DropdownMenuItem<String>(
                  value: str(v['id']), child: Text(str(v['title'])))).toList(),
                onChanged: (id) { final v = snapshot.data!.firstWhere((v) => v['id'] == id);
                  setState(() { lines[i].variantId = id; lines[i].price.text = str(v['price']); }); }),
              field('العدد', lines[i].quantity, type: TextInputType.number),
              field('سعر القطعة', lines[i].price, type: TextInputType.number),
              if (lines.length > 1) TextButton(onPressed: () => setState(() => lines.removeAt(i).dispose()),
                child: const Text('إزالة الصنف')),
            ]))),
          TextButton.icon(onPressed: lines.length >= 30 ? null : () => setState(() => lines.add(_OrderLine())),
            icon: const Icon(Icons.add), label: const Text('إضافة صنف')),
        ],
        const SizedBox(height: 12),
        const FormSection(title: 'بيانات العميل', subtitle: 'الاسم والهاتف والعنوان المطلوب للشحن.'),
        field('اسم العميل', name), field('رقم الهاتف', phone, type: TextInputType.phone),
        field('عنوان التوصيل', address, lines: 3),
        const FormSection(title: 'التحصيل', subtitle: 'يُسجّل الديبوزت فور استلامه.'),
        SwitchListTile(value: hasDeposit, onChanged: (value) => setState(() => hasDeposit = value),
          title: const Text('العميل دفع ديبوزت')),
        if (hasDeposit) field('قيمة الديبوزت', deposit, type: TextInputType.number),
        AnimatedBuilder(animation: Listenable.merge([
          deposit, ...lines.expand((line) => [line.quantity, line.price]),
        ]), builder: (context, _) {
          final total = lines.fold<double>(0, (sum, line) => sum +
            (int.tryParse(line.quantity.text) ?? 0) * (double.tryParse(line.price.text) ?? 0));
          final paid = hasDeposit ? (double.tryParse(deposit.text) ?? 0) : 0.0;
          return Card(child: Padding(padding: const EdgeInsets.all(14), child: Column(children: [
            const FormSection(title: 'ملخص الطلب'),
            ListTile(title: const Text('الإجمالي'), trailing: Text('${total.toStringAsFixed(2)} EGP')),
            ListTile(title: const Text('الديبوزت المستلم'), trailing: Text('${paid.toStringAsFixed(2)} EGP')),
            const Divider(height: 1),
            ListTile(title: const Text('المتبقي عند التسليم'),
              trailing: Text('${(total - paid).toStringAsFixed(2)} EGP')),
          ])));
        }),
      ],
    ));
}
