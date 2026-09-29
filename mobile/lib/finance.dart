import 'package:flutter/material.dart';

import 'api.dart';
import 'ui.dart';

String expenseCategoryName(String value) => switch (value) {
  'Material Purchases' => 'شراء خامات',
  'Return Cost' => 'تكلفة مرتجع',
  _ => value,
};

String expenseSummary(String value) {
  if (value.startsWith('Return for order ')) return 'تكلفة إرجاع طلب';
  if (value.startsWith('Purchase: ')) return 'شراء خامات · ${value.substring(10)}';
  return value;
}

String expenseDate(dynamic value) {
  final parsed = DateTime.tryParse(str(value));
  if (parsed == null) return str(value);
  final local = parsed.toLocal();
  return '${local.day.toString().padLeft(2, '0')}/${local.month.toString().padLeft(2, '0')}/${local.year}';
}

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
    final categories = {for (final e in entries)
      str(e['categoryId']): expenseCategoryName(str(json(e['category'])['name']))};
    final visible = category == null ? entries : entries.where((e) => e['categoryId'] == category).toList();
    final total = visible.fold<double>(0, (sum, e) => sum + amount(e['amount']));
    return RefreshIndicator(onRefresh: () async { reload(); await expenses; },
      child: ListView(padding: const EdgeInsets.fromLTRB(16, 18, 16, 30), children: [
        const PageIntro(title: 'المصروفات', subtitle: 'تابع التكاليف حسب الفئة والتاريخ', icon: Icons.payments_outlined),
        const SizedBox(height: 20),
        Container(padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(color: appNavy, borderRadius: BorderRadius.circular(20)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('إجمالي المصروفات', style: TextStyle(color: Color(0xffc5dae4), fontSize: 13)),
            const SizedBox(height: 9),
            Text('${total.toStringAsFixed(2)} EGP', textDirection: TextDirection.ltr,
              style: const TextStyle(color: Colors.white, fontSize: 26, fontWeight: FontWeight.w800)),
            const SizedBox(height: 10),
            Text('${visible.length} مصروف${category == null ? '' : ' في الفئة المحددة'}',
              style: const TextStyle(color: Color(0xffc5dae4), fontSize: 12)),
          ])),
        const SizedBox(height: 18),
        if (widget.canWrite) ...[
          SizedBox(width: double.infinity, child: FilledButton.icon(onPressed: () async {
            final added = await showModalBottomSheet<bool>(context: context,
              isScrollControlled: true, useSafeArea: true,
              backgroundColor: Colors.white,
              clipBehavior: Clip.antiAlias,
              shape: const RoundedRectangleBorder(
                borderRadius: BorderRadius.vertical(top: Radius.circular(26))),
              builder: (_) => FractionallySizedBox(heightFactor: 0.90,
                child: ExpenseForm(api: widget.api)));
            if (added == true) reload();
          }, icon: const Icon(Icons.add), label: const Text('إضافة مصروف'))),
          const SizedBox(height: 18),
        ],
        DropdownButtonFormField<String>(value: category,
          decoration: const InputDecoration(labelText: 'تصفية بالفئة'),
          items: [const DropdownMenuItem(value: null, child: Text('كل الفئات')),
            ...categories.entries.map((e) => DropdownMenuItem(value: e.key, child: Text(e.value)))],
          onChanged: (value) => setState(() => category = value)),
        const SizedBox(height: 24),
        const FormSection(title: 'سجل المصروفات'),
        if (visible.isEmpty) const Padding(padding: EdgeInsets.all(28),
          child: Center(child: Text('لا توجد مصروفات في هذه الفئة'))),
        for (final e in visible) Padding(padding: const EdgeInsets.only(bottom: 12),
          child: Card(child: InkWell(
            borderRadius: BorderRadius.circular(20),
            onTap: () => showDialog<void>(context: context,
              builder: (_) => ExpenseDetailsDialog(api: widget.api, expense: e)),
            child: Padding(padding: const EdgeInsets.all(16), child: Row(children: [
              Container(width: 42, height: 42,
                decoration: BoxDecoration(color: const Color(0xffe8f0f5),
                  borderRadius: BorderRadius.circular(12)),
                child: const Icon(Icons.receipt_long_outlined, color: appNavy, size: 21)),
              const SizedBox(width: 12),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(expenseCategoryName(str(json(e['category'])['name'])),
                  maxLines: 1, overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w800, color: appInk)),
                if (str(e['description']).trim().isNotEmpty) ...[
                  const SizedBox(height: 5),
                  Text(expenseSummary(str(e['description'])), maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 12, color: appMuted)),
                ],
                const SizedBox(height: 6),
                Text(expenseDate(e['date']), style: const TextStyle(fontSize: 11, color: appMuted)),
              ])),
              const SizedBox(width: 10),
              Text('${amount(e['amount']).toStringAsFixed(2)}\n${str(e['currency'])}',
                textDirection: TextDirection.ltr, textAlign: TextAlign.center,
                style: const TextStyle(fontWeight: FontWeight.w800, color: appNavy, fontSize: 13)),
            ]))))),
      ]));
  });
}

class ExpenseDetailsDialog extends StatefulWidget {
  const ExpenseDetailsDialog({required this.api, required this.expense, super.key});
  final ErpApi api;
  final Json expense;
  @override
  State<ExpenseDetailsDialog> createState() => _ExpenseDetailsDialogState();
}

class _ExpenseDetailsDialogState extends State<ExpenseDetailsDialog> {
  late Future<Json> details = load();
  Future<Json> load() async => json((await widget.api.get('/api/expenses/${widget.expense['id']}'))['data']);

  Widget detail(String title, dynamic value) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(title, style: const TextStyle(fontSize: 12, color: appMuted)),
      const SizedBox(height: 3),
      Text(str(value), style: const TextStyle(fontWeight: FontWeight.w700, color: appInk)),
    ]));

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: Text(expenseCategoryName(str(json(widget.expense['category'])['name']))),
    scrollable: true,
    content: SizedBox(width: double.maxFinite, child: FutureBuilder<Json>(future: details,
      builder: (context, snapshot) {
        if (snapshot.hasError) return TextButton.icon(
          onPressed: () => setState(() => details = load()),
          icon: const Icon(Icons.refresh), label: const Text('تعذر تحميل التفاصيل · حاول مجددًا'));
        if (!snapshot.hasData) return const Padding(padding: EdgeInsets.all(20),
          child: Center(child: CircularProgressIndicator()));
        final expense = snapshot.data!;
        final ret = expense['return'] is Map ? json(expense['return']) : null;
        final order = ret?['order'] is Map ? json(ret!['order']) : null;
        final purchase = expense['purchase'] is Map ? json(expense['purchase']) : null;
        final number = str(order?['orderNumber']).replaceFirst(RegExp(r'^#+'), '');
        return Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min,
          children: [
            detail('قيمة المصروف', '${str(expense['amount'])} ${str(expense['currency'])}'),
            detail('التاريخ', expenseDate(expense['date'])),
            if (order != null) ...[
              const Divider(height: 24),
              const FormSection(title: 'الطلب المرتبط بالمرتجع'),
              detail('رقم الطلب / الفاتورة', number.isEmpty ? 'غير مسجل' : '#$number'),
              if (str(order['customerRef']).isNotEmpty) detail('العميل', order['customerRef']),
              if (str(order['customerPhone']).isNotEmpty) detail('الهاتف', order['customerPhone']),
              if (str(order['customerAddress']).isNotEmpty) detail('العنوان', order['customerAddress']),
              if (order['total'] != null) detail('قيمة الطلب',
                '${str(order['total'])} ${str(order['currency'])}'),
              if (str(ret?['reason']).isNotEmpty) detail('سبب الإرجاع', ret?['reason']),
              if (ret?['items'] is List && (ret!['items'] as List).isNotEmpty) ...[
                const Divider(height: 24),
                const FormSection(title: 'الأصناف المرتجعة'),
                for (final item in (ret['items'] as List).map(json))
                  detail(str((item['orderItem'] as Map?)?['title']),
                    'العدد: ${str(item['quantity'])}'),
              ],
            ] else if (expense['returnId'] != null) ...[
              const Divider(height: 24),
              const Text('بيانات الطلب المرتبط بهذا المرتجع غير متاحة حاليًا.'),
            ] else if (purchase != null) ...[
              const Divider(height: 24),
              const FormSection(title: 'مشتريات الخامات'),
              if (purchase['supplier'] is Map)
                detail('المورد', (purchase['supplier'] as Map)['name']),
              if (str(purchase['reference']).isNotEmpty)
                detail('المرجع', purchase['reference']),
              for (final item in (purchase['items'] as List? ?? []).map(json))
                detail(str((item['material'] as Map?)?['name']),
                  '${str(item['quantity'])} ${str((item['material'] as Map?)?['unit'])}'),
            ] else ...[
              if (str(expense['description']).isNotEmpty)
                detail('الوصف', expense['description']),
              if (str(expense['reference']).isNotEmpty)
                detail('المرجع', expense['reference']),
            ],
          ]);
      })),
    actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('إغلاق'))],
  );
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
    builder: (context, snapshot) => Scaffold(
      backgroundColor: appCanvas,
      body: Column(children: [
        Container(color: Colors.white, padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
          child: Column(children: [
            Container(width: 38, height: 4, decoration: BoxDecoration(
              color: const Color(0xffcbd5da), borderRadius: BorderRadius.circular(4))),
            const SizedBox(height: 18),
            Row(children: [
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('إضافة مصروف', style: TextStyle(
                  fontSize: 21, fontWeight: FontWeight.w800, color: appInk)),
                const SizedBox(height: 4),
                const Text('سجّل تفاصيل المصروف في مكان واحد',
                  style: TextStyle(fontSize: 12, color: appMuted)),
              ])),
              IconButton(onPressed: () => Navigator.pop(context),
                tooltip: 'إغلاق', icon: const Icon(Icons.close_rounded)),
            ]),
          ])),
        Expanded(child: ListView(padding: const EdgeInsets.fromLTRB(16, 22, 16, 28), children: [
          const FormSection(title: 'الفئة', subtitle: 'اختر فئة المصروف أو أضف فئة جديدة.'),
          Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              if (snapshot.hasError) TextButton.icon(
                onPressed: () => setState(() => categories = getCategories()),
                icon: const Icon(Icons.refresh), label: const Text('تعذر تحميل الفئات، حاول مجددًا')),
              if (!snapshot.hasData && !snapshot.hasError) const LinearProgressIndicator(),
              if (snapshot.hasData) DropdownButtonFormField<String>(value: selected,
                decoration: const InputDecoration(labelText: 'فئة المصروف'),
                items: snapshot.data!.where((e) => e['active'] != false)
                  .map((e) => DropdownMenuItem(value: str(e['id']),
                    child: Text(expenseCategoryName(str(e['name']))))).toList(),
                onChanged: (value) => setState(() => selected = value)),
              const SizedBox(height: 16),
              OutlinedButton.icon(onPressed: createCategory,
                icon: const Icon(Icons.add_circle_outline),
                label: const Text('إضافة فئة جديدة')),
            ]))),
          const SizedBox(height: 24),
          const FormSection(title: 'تفاصيل المصروف'),
          Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(children: [
            field('المبلغ (EGP)', amountController, type: const TextInputType.numberWithOptions(decimal: true)),
            field('الوصف', description, lines: 2),
            const SizedBox(height: 6),
            ListTile(contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.event_outlined, color: appNavy),
              title: const Text('تاريخ المصروف'),
              subtitle: Text(expenseDate(date)),
              trailing: const Icon(Icons.chevron_left),
              onTap: () async { final chosen = await showDatePicker(context: context,
                firstDate: DateTime(2020), lastDate: DateTime(2100), initialDate: date);
                if (chosen != null) setState(() => date = chosen); }),
          ]))),
        ])),
      ]),
      bottomNavigationBar: SafeArea(top: false, child: Container(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
        decoration: const BoxDecoration(color: Colors.white,
          border: Border(top: BorderSide(color: Color(0xffe5eae6)))),
        child: FilledButton(onPressed: busy ? null : submit,
          child: Padding(padding: const EdgeInsets.symmetric(vertical: 4),
            child: Text(busy ? 'جارٍ الحفظ...' : 'حفظ المصروف'))))),
    ));
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
