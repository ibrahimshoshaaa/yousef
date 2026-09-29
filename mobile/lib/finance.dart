import 'package:flutter/material.dart';

import 'api.dart';
import 'ui.dart';

class ExpensesPage extends StatefulWidget {
  const ExpensesPage({required this.api, required this.canWrite, super.key});
  final ErpApi api;
  final bool canWrite;
  @override
  State<ExpensesPage> createState() => _ExpensesPageState();
}

class _ExpensesPageState extends State<ExpensesPage> {
  late Future<List<Json>> expenses = getExpenses();
  Future<List<Json>> getExpenses() async => rows(await widget.api.get('/api/expenses'));
  String? category;
  void reload() => setState(() => expenses = getExpenses());
  @override
  Widget build(BuildContext context) => FutureBuilder<List<Json>>(future: expenses, builder: (context, snapshot) {
    if (!snapshot.hasData) return snapshot.hasError
      ? TextButton(onPressed: reload, child: Text('تعذر التحميل: ${snapshot.error}'))
      : const PageSkeleton();
    final entries = snapshot.data!;
    final categories = {for (final e in entries) str(e['categoryId']): str(json(e['category'])['name'])};
    final visible = category == null ? entries : entries.where((e) => e['categoryId'] == category).toList();
    final total = visible.fold<double>(0, (sum, e) => sum + amount(e['amount']));
    return RefreshIndicator(onRefresh: () async { reload(); await expenses; },
      child: ListView(padding: const EdgeInsets.all(16), children: [
        const PageIntro(title: 'المصروفات', subtitle: 'تابع التكاليف حسب الفئة والتاريخ', icon: Icons.payments_outlined),
        const SizedBox(height: 14),
        Row(children: [Expanded(child: Card(child: Padding(
          padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start,
            children: [const Text('إجمالي المصروفات', style: TextStyle(color: appMuted)),
              const SizedBox(height: 6), Text('${total.toStringAsFixed(2)} EGP',
                style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: appInk)),
              Text('${visible.length} مصروف', style: const TextStyle(fontSize: 12, color: appMuted))])))),
          if (widget.canWrite) Padding(padding: const EdgeInsets.only(right: 10),
            child: FilledButton.icon(onPressed: () async {
              final added = await showModalBottomSheet<bool>(context: context,
                isScrollControlled: true, useSafeArea: true, backgroundColor: appCanvas,
                builder: (_) => FractionallySizedBox(heightFactor: 0.92,
                  child: ExpenseForm(api: widget.api)));
              if (added == true) reload();
            }, icon: const Icon(Icons.add), label: const Text('إضافة'))),
        ]),
        const SizedBox(height: 14),
        DropdownButtonFormField<String>(value: category,
          decoration: const InputDecoration(labelText: 'تصفية بالفئة'),
          items: [const DropdownMenuItem(value: null, child: Text('كل الفئات')),
            ...categories.entries.map((e) => DropdownMenuItem(value: e.key, child: Text(e.value)))],
          onChanged: (value) => setState(() => category = value)),
        const SizedBox(height: 16),
        const FormSection(title: 'سجل المصروفات'),
        if (visible.isEmpty) const Padding(padding: EdgeInsets.all(28),
          child: Center(child: Text('لا توجد مصروفات في هذه الفئة'))),
        for (final e in visible) Card(child: ListTile(title: Text(str(json(e['category'])['name'])),
          subtitle: Text('${str(e['description'])} · ${str(e['date'])}'),
          trailing: Text('${str(e['amount'])} ${str(e['currency'])}'))),
      ]));
  });
}

class ExpenseForm extends StatefulWidget {
  const ExpenseForm({required this.api, super.key});
  final ErpApi api;
  @override
  State<ExpenseForm> createState() => _ExpenseFormState();
}

class _ExpenseFormState extends State<ExpenseForm> {
  late Future<List<Json>> categories = getCategories();
  Future<List<Json>> getCategories() async => rows(await widget.api.get('/api/expenses/categories'));
  final amountController = TextEditingController();
  final description = TextEditingController();
  String? selected;
  DateTime date = DateTime.now();
  bool busy = false;
  @override
  void dispose() { amountController.dispose(); description.dispose(); super.dispose(); }

  Future<void> createCategory() async {
    final controller = TextEditingController();
    final name = await showDialog<String>(context: context, builder: (dialogContext) => AlertDialog(
      title: const Text('فئة مصروف جديدة'),
      content: TextField(controller: controller, autofocus: true,
        decoration: const InputDecoration(labelText: 'اسم الفئة'),
        onSubmitted: (value) => Navigator.pop(dialogContext, value.trim())),
      actions: [TextButton(onPressed: () => Navigator.pop(dialogContext), child: const Text('إلغاء')),
        FilledButton(onPressed: () => Navigator.pop(dialogContext, controller.text.trim()),
          child: const Text('إضافة'))]));
    controller.dispose();
    if (!mounted || name == null) return;
    if (name.isEmpty) { showMessage(context, 'اكتب اسم الفئة الجديدة'); return; }
    try {
      final result = await widget.api.post('/api/expenses/categories', {'name': name});
      if (mounted) setState(() { selected = str(json(result['data'])['id']); categories = getCategories(); });
    } catch (e) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e'))); }
  }

  Future<void> submit() async {
    final value = double.tryParse(amountController.text);
    if (selected == null || value == null || value <= 0) {
      showMessage(context, 'اختر فئة وأدخل مبلغًا أكبر من صفر'); return;
    }
    setState(() => busy = true);
    try {
      await perform(context, () => widget.api.post('/api/expenses', {
        'categoryId': selected, 'amount': value, 'date': date.toUtc().toIso8601String(),
        'description': description.text.trim(),
      }));
      if (mounted) Navigator.pop(context, true);
    } catch (_) { /* The shared helper displays the server error. */ }
    finally { if (mounted) setState(() => busy = false); }
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<List<Json>>(future: categories,
    builder: (context, snapshot) => FormScaffold(title: 'إضافة مصروف', busy: busy, onSubmit: submit,
      children: [
        const FormSection(title: 'بيانات المصروف', subtitle: 'اختار فئة موجودة أو أنشئ فئة جديدة.'),
        if (snapshot.hasError) Text('تعذر تحميل الفئات: ${snapshot.error}'),
        if (snapshot.hasData) DropdownButtonFormField<String>(value: selected,
          decoration: const InputDecoration(labelText: 'الفئة'),
          items: snapshot.data!.where((e) => e['active'] != false)
            .map((e) => DropdownMenuItem(value: str(e['id']), child: Text(str(e['name'])))).toList(),
          onChanged: (value) => setState(() => selected = value)),
        Align(alignment: Alignment.centerRight, child: OutlinedButton.icon(onPressed: createCategory,
          icon: const Icon(Icons.create_new_folder_outlined), label: const Text('إضافة فئة جديدة'))),
        field('المبلغ (EGP)', amountController, type: TextInputType.number),
        field('الوصف', description),
        ListTile(title: const Text('تاريخ المصروف'), subtitle: Text('${date.year}-${date.month}-${date.day}'),
          onTap: () async { final chosen = await showDatePicker(context: context,
            firstDate: DateTime(2020), lastDate: DateTime(2100), initialDate: date);
            if (chosen != null) setState(() => date = chosen); }),
      ]));
}

class ReturnsPage extends StatelessWidget {
  const ReturnsPage({required this.api, required this.canWrite, super.key});
  final ErpApi api;
  final bool canWrite;
  @override
  Widget build(BuildContext context) => DataView(api: api, path: '/api/returns',
    title: 'المرتجعات', subtitle: 'افحص الأصناف وحدد ما يعود للمخزون', icon: Icons.assignment_return_outlined,
    item: (context, ret, reload) => Card(child: ExpansionTile(
      title: Text('طلب #${str(json(ret['order'])['orderNumber'])}'),
      subtitle: Text('${str(ret['status'])} · ${str(ret['totalAmount'])} EGP'),
      children: [
        for (final item in (ret['items'] as List).map(json)) ListTile(
          title: Text(str(json(item['orderItem'])['title'])),
          subtitle: Text('العدد ${str(item['quantity'])} · ${str(item['condition'])}')),
        if (canWrite && ret['processedAt'] == null && (ret['items'] as List).isNotEmpty)
          ListTile(title: const Text('معالجة المرتجع'), trailing: const Icon(Icons.chevron_left),
            onTap: () async { final saved = await openPage<bool>(context, ReturnForm(api: api, record: ret));
              if (saved == true) reload(); }),
      ],
    )));
}

class ReturnForm extends StatefulWidget {
  const ReturnForm({required this.api, required this.record, super.key});
  final ErpApi api;
  final Json record;
  @override
  State<ReturnForm> createState() => _ReturnFormState();
}

class _ReturnFormState extends State<ReturnForm> {
  final cost = TextEditingController();
  final decisions = <String, String>{};
  final restock = <String, bool>{};
  bool busy = false;
  @override
  void dispose() { cost.dispose(); super.dispose(); }
  Future<void> submit() async {
    final items = (widget.record['items'] as List).map(json).toList();
    if (items.any((i) => (decisions[str(i['id'])] ?? 'UNKNOWN') == 'UNKNOWN')) {
      showMessage(context, 'حدد حالة كل صنف في المرتجع'); return;
    }
    if (cost.text.trim().isNotEmpty && (double.tryParse(cost.text) ?? -1) < 0) {
      showMessage(context, 'تكلفة المرتجع يجب أن تكون صفرًا أو أكثر'); return;
    }
    if (!await confirm(context, 'سيتم اعتماد المرتجع وتسجيل تكلفته وحركة المخزون.')) return;
    setState(() => busy = true);
    try {
      await perform(context, () => widget.api.post('/api/returns/${Uri.encodeComponent(str(widget.record['id']))}/process', {
        if (cost.text.isNotEmpty) 'returnCost': double.parse(cost.text),
        'items': items.map((i) => {'id': i['id'], 'condition': decisions[str(i['id'])],
          'restock': restock[str(i['id'])] ?? false}).toList(),
      }), success: 'تم اعتماد المرتجع');
      if (mounted) Navigator.pop(context, true);
    } catch (_) { /* The shared helper displays the server error. */ }
    finally { if (mounted) setState(() => busy = false); }
  }

  @override
  Widget build(BuildContext context) => FormScaffold(title: 'معالجة المرتجع', busy: busy,
    onSubmit: submit, children: [
      for (final item in (widget.record['items'] as List).map(json)) Card(child: Column(children: [
        ListTile(title: Text(str(json(item['orderItem'])['title'])), subtitle: Text('العدد ${item['quantity']}')),
        DropdownButtonFormField<String>(value: decisions[str(item['id'])] ?? 'UNKNOWN',
          items: const {'UNKNOWN': 'حدد الحالة', 'GOOD': 'جيد', 'DAMAGED': 'تالف',
            'OPENED': 'مفتوح', 'UNSELLABLE': 'غير قابل للبيع'}.entries
            .map((e) => DropdownMenuItem(value: e.key, child: Text(e.value))).toList(),
          onChanged: (value) => setState(() { decisions[str(item['id'])] = value!;
            if (value != 'GOOD') restock[str(item['id'])] = false; })),
        CheckboxListTile(value: restock[str(item['id'])] ?? false,
          onChanged: decisions[str(item['id'])] == 'GOOD'
            ? (value) => setState(() => restock[str(item['id'])] = value ?? false) : null,
          title: const Text('إعادة مكونات الوصفة للمخزون')),
      ])),
      field('تكلفة المرتجع (فارغ للقيمة الافتراضية)', cost, type: TextInputType.number),
    ]);
}
