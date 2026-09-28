import 'package:flutter/material.dart';
import 'package:uuid/uuid.dart';

import 'api.dart';
import 'ui.dart';

const orderStages = {'NEW': 'قيد التجهيز', 'PREPARED': 'تم التجهيز',
  'SHIPPING': 'جاري الشحن', 'DELIVERED': 'تم التسليم', 'RETURNED': 'تم الإرجاع'};

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
    final body = <Widget>[
      if (widget.canWrite) FilledButton.icon(onPressed: newOrder,
        icon: const Icon(Icons.add), label: const Text('إضافة طلب')),
      Row(children: [
        Expanded(child: TextField(controller: search,
          onSubmitted: (_) { page = 1; reload(); },
          decoration: const InputDecoration(labelText: 'رقم الطلب أو اسم العميل'))),
        IconButton(onPressed: () { page = 1; reload(); }, icon: const Icon(Icons.search)),
      ]),
    ];
    if (!snapshot.hasData && !snapshot.hasError) body.add(const Center(child: CircularProgressIndicator()));
    if (snapshot.hasError) body.add(TextButton(onPressed: reload, child: Text('إعادة المحاولة: ${snapshot.error}')));
    if (snapshot.hasData) {
      final data = snapshot.data as Map;
      final orders = (data['data'] as List).map(json);
      body.addAll(orders.map((o) => Card(child: ExpansionTile(
        title: Text('طلب #${str(o['orderNumber'])}'),
        subtitle: Text('${orderStages[str(o['manualStatus'])] ?? str(o['fulfillmentStatus'])} · ${str(o['customerRef'])} · ${str(o['total'])} ${str(o['currency'])}'),
        children: [
          ListTile(title: const Text('بيانات العميل'), subtitle: Text('${str(o['customerRef'])}\n${str(o['customerPhone'])}\n${str(o['customerAddress'])}')),
          ListTile(title: const Text('الديبوزت'), subtitle: Text('${str(o['depositAmount'])} ${str(o['currency'])}')),
          ...((o['items'] as List).map(json)).map((item) => ListTile(
            title: Text(str(item['title'])),
            subtitle: Text('العدد: ${str(item['quantity'])} · ${str(item['consumptionStatus'])}'))),
          if (widget.canWrite && o['manualStatus'] != null) ...[
            if (o['manualStatus'] == 'NEW') action(o, 'PREPARED', 'تم التجهيز وخصم الخامات'),
            if (o['manualStatus'] == 'PREPARED') action(o, 'SHIPPING', 'جاري الشحن'),
            if (o['manualStatus'] == 'SHIPPING') ...[
              action(o, 'DELIVERED', 'تم التسليم وتحصيل المبلغ'),
              action(o, 'RETURNED', 'تم الإرجاع وإعادة الخامات', destructive: true),
            ],
          ],
        ],
      ))));
      body.add(Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        TextButton(onPressed: page <= 1 ? null : () { page--; reload(); }, child: const Text('السابق')),
        Text('صفحة $page · ${data['count']} طلب'),
        TextButton(onPressed: data['hasMore'] == true ? () { page++; reload(); } : null,
          child: const Text('التالي')),
      ]));
    }
    return RefreshIndicator(onRefresh: () async { reload(); await result; },
      child: ListView(padding: const EdgeInsets.all(16), children: body));
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
          (int.tryParse(line.quantity.text) ?? 0) < 1) ||
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
        if (!snapshot.hasData) const LinearProgressIndicator(),
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
        field('اسم العميل', name), field('رقم الهاتف', phone, type: TextInputType.phone),
        field('عنوان التوصيل', address, lines: 3),
        SwitchListTile(value: hasDeposit, onChanged: (value) => setState(() => hasDeposit = value),
          title: const Text('العميل دفع ديبوزت')),
        if (hasDeposit) field('قيمة الديبوزت', deposit, type: TextInputType.number),
      ],
    ));
}
