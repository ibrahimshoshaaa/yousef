import 'package:flutter/material.dart';

import 'api.dart';
import 'inventory.dart';
import 'ui.dart';

class MaterialsPage extends StatelessWidget {
  const MaterialsPage({required this.api, required this.canWrite, super.key});
  final ErpApi api;
  final bool canWrite;
  @override
  Widget build(BuildContext context) => DataView(api: api, path: '/api/materials',
    title: 'الخامات', subtitle: 'تعريف المواد وأسعارها وحد إعادة الشراء', icon: Icons.category_outlined,
    action: canWrite ? (context, reload) => FilledButton.icon(onPressed: () async {
      final saved = await openPage<bool>(context, MaterialForm(api: api));
      if (saved == true) reload();
    }, icon: const Icon(Icons.add), label: const Text('إضافة خامة')) : null,
    item: (context, m, reload) => Card(child: ListTile(
      title: Text(str(m['name'])),
      subtitle: Text('${str((m['materialType'] as Map?)?['name'])} · ${str((m['balance'] as Map?)?['quantity'])} ${str(m['unit'])}'),
      trailing: canWrite ? IconButton(icon: const Icon(Icons.edit_outlined),
        tooltip: 'تعديل الخامة', onPressed: () async {
          final saved = await openPage<bool>(context, MaterialForm(api: api, material: m));
          if (saved == true) reload();
        }) : const Icon(Icons.chevron_left), onTap: () async {
        await openPage(context, MaterialDetail(api: api, material: m, canWrite: canWrite));
        reload();
      },
    )));
}

class MaterialForm extends StatefulWidget {
  const MaterialForm({required this.api, this.material, super.key});
  final ErpApi api;
  final Json? material;
  @override
  State<MaterialForm> createState() => _MaterialFormState();
}

class _MaterialFormState extends State<MaterialForm> {
  final name = TextEditingController(); final sku = TextEditingController();
  final cost = TextEditingController(); final reorder = TextEditingController();
  final capacity = TextEditingController();
  late Future<List<Json>> types = load('/api/material-types');
  late Future<List<Json>> suppliers = load('/api/suppliers');
  Future<List<Json>> load(String path) async => rows(await widget.api.get(path));
  String? typeId;
  String? supplierId;
  String unit = 'قطعة';
  bool busy = false;
  final newType = TextEditingController();
  Future<void> addType() async {
    if (newType.text.trim().isEmpty) { showMessage(context, 'اكتب اسم النوع الجديد'); return; }
    try {
      final response = await widget.api.post('/api/material-types', {'name': newType.text.trim()});
      if (mounted) setState(() {
        typeId = str(json(response['data'])['id']); types = load('/api/material-types'); newType.clear();
      });
    } catch (e) { if (mounted) showMessage(context, '$e'); }
  }
  @override
  void initState() {
    super.initState();
    final data = widget.material;
    if (data != null) {
      name.text = str(data['name']); sku.text = str(data['sku']);
      cost.text = str(data['defaultCost']); reorder.text = str(data['reorderLevel']);
      capacity.text = str(data['capacityMl']); typeId = str(data['materialTypeId']);
      supplierId = data['supplierId']?.toString(); unit = str(data['unit']);
    }
  }
  @override
  void dispose() { name.dispose(); sku.dispose(); cost.dispose(); reorder.dispose(); capacity.dispose(); newType.dispose(); super.dispose(); }

  Future<void> submit() async {
    if (name.text.trim().isEmpty || typeId == null) {
      showMessage(context, 'اكتب اسم الخامة واختر نوعها'); return;
    }
    final defaultCost = cost.text.isEmpty ? null : double.tryParse(cost.text);
    final reorderLevel = reorder.text.isEmpty ? null : double.tryParse(reorder.text);
    final capacityMl = capacity.text.isEmpty ? null : double.tryParse(capacity.text);
    if ((cost.text.isNotEmpty && defaultCost == null) ||
      (reorder.text.isNotEmpty && reorderLevel == null) ||
      (capacity.text.isNotEmpty && capacityMl == null) ||
      (defaultCost != null && defaultCost < 0) ||
      (reorderLevel != null && reorderLevel < 0) ||
      (capacityMl != null && capacityMl < 0)) {
      showMessage(context, 'راجع القيم الرقمية المدخلة'); return;
    }
    setState(() => busy = true);
    try {
      final fields = {'name': name.text.trim(), 'sku': sku.text.trim(),
        'supplierId': supplierId, 'defaultCost': defaultCost,
        'reorderLevel': reorderLevel, 'capacityMl': capacityMl,
        if (widget.material != null) 'materialTypeId': typeId,
        if (widget.material == null) 'unit': unit,
        if (widget.material == null) 'baseUnit': unit};
      if (widget.material == null) {
        await perform(context, () => widget.api.post('/api/materials', {
          ...fields, 'materialTypeId': typeId,
        }));
      } else {
        await perform(context, () => widget.api.patch('/api/materials/${widget.material!['id']}', fields));
      }
      if (mounted) Navigator.pop(context, true);
    } catch (_) { /* Error shown by helper. */ }
    finally { if (mounted) setState(() => busy = false); }
  }

  @override
  Widget build(BuildContext context) => FormScaffold(title: widget.material == null ? 'إضافة خامة' : 'تعديل الخامة',
    busy: busy, onSubmit: submit, children: [
      const FormSection(title: 'بيانات الخامة', subtitle: 'حدد نوع الخامة والوحدة قبل الحفظ.'),
      FutureBuilder<List<Json>>(future: types, builder: (context, snapshot) => snapshot.hasData
        ? DropdownButtonFormField<String>(value: typeId,
          decoration: const InputDecoration(labelText: 'نوع الخامة'),
          items: snapshot.data!.map((entry) => DropdownMenuItem(value: str(entry['id']),
            child: Text(str(entry['name'])))).toList(),
          onChanged: (value) => setState(() => typeId = value)) : snapshot.hasError
          ? TextButton(onPressed: () => setState(() => types = load('/api/material-types')),
            child: const Text('تعذر تحميل الأنواع · إعادة المحاولة'))
          : const LinearProgressIndicator()),
      Row(children: [Expanded(child: field('نوع جديد', newType)),
        const SizedBox(width: 8), OutlinedButton.icon(onPressed: addType,
          icon: const Icon(Icons.add), label: const Text('إضافة'))]),
      field('اسم الخامة', name), field('SKU', sku),
      DropdownButtonFormField<String>(value: unit,
        decoration: const InputDecoration(labelText: 'الوحدة'),
        items: ['مل', 'قطعة'].map((u) => DropdownMenuItem(value: u, child: Text(u))).toList(),
        onChanged: widget.material == null ? (value) => setState(() => unit = value!) : null),
      FutureBuilder<List<Json>>(future: suppliers, builder: (context, snapshot) => snapshot.hasData
        ? DropdownButtonFormField<String>(value: supplierId,
          decoration: const InputDecoration(labelText: 'المورد (اختياري)'),
          items: [const DropdownMenuItem(value: null, child: Text('بدون مورد')),
            ...snapshot.data!.map((entry) => DropdownMenuItem(value: str(entry['id']),
              child: Text(str(entry['name']))))],
          onChanged: (value) => setState(() => supplierId = value)) : const LinearProgressIndicator()),
      field('سعر الوحدة الافتراضي', cost, type: TextInputType.number),
      field('حد إعادة الشراء', reorder, type: TextInputType.number),
      field('السعة (مل)', capacity, type: TextInputType.number),
    ]);
}

class SuppliersPage extends StatelessWidget {
  const SuppliersPage({required this.api, required this.canWrite, super.key});
  final ErpApi api; final bool canWrite;
  @override
  Widget build(BuildContext context) => DataView(api: api, path: '/api/suppliers',
    title: 'الموردون', subtitle: 'بيانات التواصل مع موردي الخامات', icon: Icons.local_shipping_outlined,
    action: canWrite ? (context, reload) => FilledButton.icon(onPressed: () async {
      final saved = await openPage<bool>(context, SupplierForm(api: api));
      if (saved == true) reload();
    }, icon: const Icon(Icons.add), label: const Text('إضافة مورد')) : null,
    item: (context, item, reload) => Card(child: ListTile(
      title: Text(str(item['name'])), subtitle: Text(str(item['phone'])),
      onTap: canWrite ? () async {
        await openPage(context, SupplierForm(api: api, supplier: item)); reload();
      } : null,
    )));
}

class SupplierForm extends StatefulWidget {
  const SupplierForm({required this.api, this.supplier, super.key});
  final ErpApi api; final Json? supplier;
  @override
  State<SupplierForm> createState() => _SupplierFormState();
}
class _SupplierFormState extends State<SupplierForm> {
  final name = TextEditingController(); final phone = TextEditingController();
  final email = TextEditingController(); final notes = TextEditingController();
  bool busy = false;
  @override
  void initState() { super.initState();
    name.text = str(widget.supplier?['name']); phone.text = str(widget.supplier?['phone']);
    email.text = str(widget.supplier?['email']); notes.text = str(widget.supplier?['notes']); }
  @override
  void dispose() { name.dispose(); phone.dispose(); email.dispose(); notes.dispose(); super.dispose(); }
  Future<void> save() async {
    if (name.text.trim().isEmpty) { showMessage(context, 'اكتب اسم المورد'); return; }
    setState(() => busy = true);
    try {
      final data = {'name': name.text.trim(), 'phone': phone.text.trim(),
        'email': email.text.trim().isEmpty ? null : email.text.trim(), 'notes': notes.text.trim()};
      await perform(context, () => widget.supplier == null
        ? widget.api.post('/api/suppliers', data)
        : widget.api.patch('/api/suppliers/${widget.supplier!['id']}', data));
      if (mounted) Navigator.pop(context, true);
    } catch (_) { /* Error shown by helper. */ }
    finally { if (mounted) setState(() => busy = false); }
  }
  @override
  Widget build(BuildContext context) => FormScaffold(title: 'بيانات المورد', busy: busy,
    onSubmit: save, children: [field('الاسم', name), field('الهاتف', phone),
      field('البريد الإلكتروني', email), field('ملاحظات', notes, lines: 3)]);
}
