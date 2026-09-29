import 'package:flutter/material.dart';
import 'package:uuid/uuid.dart';

import 'api.dart';
import 'ui.dart';

class InventoryPage extends StatefulWidget {
  const InventoryPage({required this.api, required this.canWrite, super.key});
  final ErpApi api;
  final bool canWrite;
  @override
  State<InventoryPage> createState() => _InventoryPageState();
}

class _InventoryPageState extends State<InventoryPage> {
  final search = TextEditingController();
  late Future<List<Json>> future = load();
  Future<List<Json>> load() async => rows(await widget.api.get('/api/materials'));
  void reload() => setState(() => future = load());

  @override
  void dispose() { search.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) => FutureBuilder<List<Json>>(future: future,
    builder: (context, snapshot) {
      if (!snapshot.hasData) return snapshot.hasError
        ? Center(child: TextButton.icon(onPressed: reload,
            icon: const Icon(Icons.refresh), label: const Text('إعادة تحميل المخزون')))
        : const PageSkeleton();
      final all = snapshot.data!;
      final filtered = all.where((m) => str(m['name']).toLowerCase()
        .contains(search.text.trim().toLowerCase())).toList();
      final groups = <String, List<Json>>{};
      for (final material in filtered) {
        final type = material['materialType'] is Map
          ? str(json(material['materialType'])['name']) : 'خامـات أخرى';
        groups.putIfAbsent(type, () => []).add(material);
      }
      return RefreshIndicator(onRefresh: () async { reload(); await future; },
        child: ListView(padding: const EdgeInsets.fromLTRB(16, 16, 16, 24), children: [
          Row(children: [
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start,
              children: [const Text('المخزون', style: TextStyle(fontSize: 22,
                fontWeight: FontWeight.w800)),
                Text('${all.length} خامة مسجلة',
                  style: const TextStyle(color: Color(0xff718079), fontSize: 13))])),
            if (widget.canWrite) FilledButton.icon(onPressed: () async {
              final saved = await openPage<bool>(context, StockForm(api: widget.api));
              if (saved == true) reload();
            }, icon: const Icon(Icons.add, size: 19), label: const Text('إضافة')),
          ]),
          const SizedBox(height: 18),
          TextField(controller: search, onChanged: (_) => setState(() {}),
            decoration: const InputDecoration(hintText: 'ابحث عن خامة',
              prefixIcon: Icon(Icons.search))),
          const SizedBox(height: 18),
          if (groups.isEmpty) const Padding(padding: EdgeInsets.all(32),
            child: Center(child: Text('لا توجد خامات مطابقة'))),
          for (final group in groups.entries) Padding(
            padding: const EdgeInsets.only(bottom: 14),
            child: Card(child: Column(children: [
              Padding(padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
                child: Row(children: [
                  Expanded(child: Text(group.key, style: const TextStyle(
                    fontSize: 17, fontWeight: FontWeight.w800))),
                  Text('${group.value.length} خامة', style: const TextStyle(
                    color: Color(0xff718079), fontSize: 12)),
                ])),
              const Divider(height: 1),
              for (var i = 0; i < group.value.length; i++) ...[
                if (i > 0) const Divider(height: 1, indent: 16, endIndent: 16),
                ListTile(contentPadding: const EdgeInsets.symmetric(horizontal: 16,
                  vertical: 4),
                  title: Text(str(group.value[i]['name']),
                    style: const TextStyle(fontWeight: FontWeight.w600)),
                  subtitle: const Text('عرض التفاصيل وحركة المخزون',
                    style: TextStyle(fontSize: 11)),
                  trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                    Text('${str((group.value[i]['balance'] as Map?)?['quantity'])} '
                      '${str(group.value[i]['unit'])}',
                      style: const TextStyle(color: Color(0xff173d34),
                        fontWeight: FontWeight.w800, fontSize: 13)),
                    const SizedBox(width: 4),
                    const Icon(Icons.chevron_left, size: 20),
                  ]),
                  onTap: () async {
                    await openPage(context, MaterialDetail(api: widget.api,
                      material: group.value[i], canWrite: widget.canWrite));
                    reload();
                  }),
              ],
            ])),
          ),
        ]));
    });
}

class StockForm extends StatefulWidget {
  const StockForm({required this.api, super.key});
  final ErpApi api;
  @override
  State<StockForm> createState() => _StockFormState();
}

class _StockFormState extends State<StockForm> {
  final name = TextEditingController();
  final quantity = TextEditingController();
  final price = TextEditingController();
  final categoryName = TextEditingController();
  final requestId = const Uuid().v4();
  late Future<List<Json>> types = loadTypes();
  Future<List<Json>> loadTypes() async => rows(await widget.api.get('/api/material-types'));
  String category = 'OILS';
  String unit = 'قطعة';
  bool busy = false;
  static const builtins = {'OILS': 'زيوت', 'BOTTLES': 'زجاجات',
    'BOXES': 'بوكسات التغليف', 'TESTERS': 'زجاجات تيستر'};
  @override
  void dispose() { name.dispose(); quantity.dispose(); price.dispose(); categoryName.dispose(); super.dispose(); }

  Future<void> addType() async {
    if (categoryName.text.trim().isEmpty) { showMessage(context, 'اكتب اسم نوع الخامة'); return; }
    try {
      final response = await widget.api.post('/api/material-types', {'name': categoryName.text.trim()});
      if (!mounted) return;
      setState(() { category = 'type:${json(response['data'])['id']}'; types = loadTypes(); });
    } catch (e) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e'))); }
  }

  Future<void> submit() async {
    final qty = double.tryParse(quantity.text);
    final cost = double.tryParse(price.text);
    final currentUnit = category == 'OILS' ? 'مل' : category.startsWith('type:') ? unit : 'قطعة';
    if (name.text.trim().isEmpty || qty == null || qty <= 0 || cost == null || cost <= 0 ||
      (currentUnit == 'قطعة' && qty != qty.truncateToDouble())) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('راجع اسم الخامة والكمية وسعر الشراء'))); return;
    }
    setState(() => busy = true);
    try {
      await perform(context, () => widget.api.post('/api/inventory/stock', {
        'requestId': requestId, 'category': category, 'name': name.text.trim(),
        'quantity': qty, 'amount': cost, 'unit': currentUnit,
      }), success: 'تمت إضافة المخزون وتسجيل المصروف');
      if (mounted) Navigator.pop(context, true);
    } catch (_) { /* The shared helper displays the server error. */ }
    finally { if (mounted) setState(() => busy = false); }
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<List<Json>>(future: types,
    builder: (context, snapshot) => FormScaffold(title: 'إضافة مخزون', busy: busy,
      onSubmit: submit, children: [
        if (snapshot.hasError) Text('تعذر تحميل أنواع الخامات: ${snapshot.error}'),
        DropdownButtonFormField<String>(value: category,
          decoration: const InputDecoration(labelText: 'النوع'),
          items: [
            ...builtins.entries.map((e) => DropdownMenuItem(value: e.key, child: Text(e.value))),
            if (category.startsWith('type:') &&
              (snapshot.data == null || !snapshot.data!.any((t) => 'type:${t['id']}' == category)))
              DropdownMenuItem(value: category, child: const Text('نوع جديد')),
            if (snapshot.hasData) ...snapshot.data!.where((t) => !builtins.values.contains(t['name']))
              .map((t) => DropdownMenuItem(value: 'type:${t['id']}', child: Text(str(t['name'])))),
          ], onChanged: (value) => setState(() => category = value!)),
        field('اسم الخامة', name),
        if (category.startsWith('type:')) DropdownButtonFormField<String>(value: unit,
          items: ['قطعة', 'مل'].map((u) => DropdownMenuItem(value: u, child: Text(u))).toList(),
          onChanged: (value) => setState(() => unit = value!)),
        field('الكمية', quantity, type: TextInputType.number),
        field('سعر الكمية كلها (جنيه)', price, type: TextInputType.number),
        const SizedBox(height: 12),
        const FormSection(title: 'نوع خامة جديد', subtitle: 'أضفه إذا لم تجده في القائمة أعلاه.'),
        field('اسم النوع الجديد', categoryName),
        OutlinedButton.icon(onPressed: addType, icon: const Icon(Icons.add),
          label: const Text('إضافة النوع واختياره')),
      ]));
}

class MaterialDetail extends StatefulWidget {
  const MaterialDetail({required this.api, required this.material, required this.canWrite, super.key});
  final ErpApi api;
  final Json material;
  final bool canWrite;
  @override
  State<MaterialDetail> createState() => _MaterialDetailState();
}

class _MaterialDetailState extends State<MaterialDetail> {
  final qty = TextEditingController();
  final reason = TextEditingController();
  late Future<Json> material = fetchMaterial();
  Future<Json> fetchMaterial() async => json((await widget.api.get('/api/materials/${widget.material['id']}'))['data']);
  late Future<dynamic> transactions = widget.api.get('/api/inventory/transactions?materialId=${Uri.encodeComponent(str(widget.material['id']))}');
  @override
  void dispose() { qty.dispose(); reason.dispose(); super.dispose(); }

  Future<void> adjust(bool add) async {
    final value = double.tryParse(qty.text);
    if (value == null || value <= 0 || reason.text.trim().isEmpty) {
      showMessage(context, 'اكتب كمية أكبر من صفر وسبب التسوية'); return;
    }
    if (!await confirm(context, '${add ? 'إضافة' : 'خصم'} $value ${widget.material['unit']} من المخزون؟')) return;
    try {
      await perform(context, () => widget.api.post('/api/inventory/adjustments', {
        'materialId': widget.material['id'], 'quantity': add ? value : -value,
        'reason': reason.text.trim(),
      }));
      qty.clear(); reason.clear();
      setState(() {
        material = fetchMaterial();
        transactions = widget.api.get('/api/inventory/transactions?materialId=${Uri.encodeComponent(str(widget.material['id']))}');
      });
    } catch (_) { /* The shared helper displays the server error. */ }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(str(widget.material['name']))),
    body: ListView(padding: const EdgeInsets.all(16), children: [
      PageIntro(title: str(widget.material['name']), subtitle: 'الرصيد وحركة المخزون', icon: Icons.warehouse_outlined),
      const SizedBox(height: 16),
      FutureBuilder<Json>(future: material, builder: (context, snapshot) {
        if (!snapshot.hasData) return snapshot.hasError
          ? TextButton(onPressed: () => setState(() => material = fetchMaterial()),
              child: const Text('تعذر تحميل الرصيد · إعادة المحاولة'))
          : const PageSkeleton(embedded: true);
        final current = snapshot.data!;
        return Row(children: [
          Expanded(child: Card(child: Padding(padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('الرصيد الحالي', style: TextStyle(color: appMuted)),
              const SizedBox(height: 12),
              Text('${str((current['balance'] as Map?)?['quantity'])} ${str(current['unit'])}',
                style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
            ])))),
          Expanded(child: Card(child: Padding(padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('تكلفة الوحدة', style: TextStyle(color: appMuted)),
              const SizedBox(height: 12),
              Text('${str(current['defaultCost'])} EGP',
                style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
            ])))),
        ]);
      }),
      if (widget.canWrite) ...[
        const SizedBox(height: 16), const FormSection(title: 'تسوية المخزون', subtitle: 'سجّل سبب كل إضافة أو خصم.'),
        field('الكمية', qty, type: TextInputType.number), field('السبب', reason),
        Row(children: [
          Expanded(child: OutlinedButton(onPressed: () => adjust(false), child: const Text('خصم'))),
          const SizedBox(width: 8),
          Expanded(child: FilledButton(onPressed: () => adjust(true), child: const Text('إضافة'))),
        ]),
      ],
      const SizedBox(height: 20), const FormSection(title: 'حركة المخزون'),
      FutureBuilder<dynamic>(future: transactions, builder: (context, snapshot) {
        if (!snapshot.hasData) return snapshot.hasError
          ? TextButton(onPressed: () => setState(() => transactions = widget.api.get('/api/inventory/transactions?materialId=${Uri.encodeComponent(str(widget.material['id']))}')),
              child: const Text('تعذر تحميل الحركة · إعادة المحاولة'))
          : const PageSkeleton(embedded: true);
        final data = (snapshot.data as Map)['data'];
        return Column(children: [for (final tx in (data as List).map(json))
          ListTile(title: Text(str(tx['type'])),
            subtitle: Text('${str(tx['quantity'])} ${str(tx['unit'])} · ${str(tx['reason'])}'))]);
      }),
    ]),
  );
}
