import 'package:flutter/material.dart';

import 'api.dart';
import 'ui.dart';

class RecipesPage extends StatelessWidget {
  const RecipesPage({required this.api, required this.canWrite, super.key});
  final ErpApi api;
  final bool canWrite;
  @override
  Widget build(BuildContext context) => DataView(api: api, path: '/api/recipes',
    action: canWrite ? (context, reload) => FilledButton.icon(onPressed: () async {
      final saved = await openPage<bool>(context, RecipeForm(api: api));
      if (saved == true) reload();
    }, icon: const Icon(Icons.add), label: const Text('إضافة وصفة')) : null,
    item: (context, recipe, reload) => Card(child: ListTile(
      title: Text(str(recipe['name'])),
      subtitle: Text('المنتج: ${str((recipe['variant'] as Map?)?['title'])}'),
      trailing: const Icon(Icons.chevron_left),
      onTap: () async { await openPage(context, RecipeDetail(api: api,
        id: str(recipe['id']), canWrite: canWrite)); reload(); },
    )));
}

class RecipeDetail extends StatefulWidget {
  const RecipeDetail({required this.api, required this.id, required this.canWrite, super.key});
  final ErpApi api; final String id; final bool canWrite;
  @override
  State<RecipeDetail> createState() => _RecipeDetailState();
}
class _RecipeDetailState extends State<RecipeDetail> {
  late Future<dynamic> record = widget.api.get('/api/recipes/${widget.id}');
  void reload() => setState(() => record = widget.api.get('/api/recipes/${widget.id}'));
  @override
  Widget build(BuildContext context) => Scaffold(appBar: AppBar(title: const Text('تفاصيل الوصفة')),
    body: FutureBuilder<dynamic>(future: record, builder: (context, snapshot) {
      if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
      final recipe = json(snapshot.data['data']);
      final versions = (recipe['versions'] as List).map(json).toList();
      return ListView(padding: const EdgeInsets.all(16), children: [
        ListTile(title: Text(str(recipe['name'])), subtitle: Text('التكلفة ${str(recipe['cost'])} EGP')),
        for (final v in versions) Card(child: ExpansionTile(
          title: Text('النسخة v${v['version']} ${v['isCurrent'] == true ? '· الحالية' : ''}'),
          children: [
            for (final line in (v['items'] as List).map(json)) ListTile(
              title: Text(str((line['material'] as Map?)?['name'])),
              subtitle: Text('${str(line['quantity'])} ${str(line['unit'])}')),
            if (widget.canWrite && v['isCurrent'] != true) TextButton(
              onPressed: () async {
                if (!await confirm(context, 'تفعيل هذه النسخة للاستهلاك القادم؟')) return;
                try { await perform(context, () => widget.api.post('/api/recipes/${widget.id}/versions/${v['id']}/activate', {})); reload(); }
                catch (_) { /* Error shown by helper. */ }
              }, child: const Text('تفعيل النسخة')),
          ],
        )),
        if (widget.canWrite) FilledButton(onPressed: () async {
          final saved = await openPage<bool>(context, RecipeForm(api: widget.api, recipeId: widget.id));
          if (saved == true) reload();
        }, child: const Text('إنشاء نسخة جديدة')),
      ]);
    }));
}

class _RecipeLine {
  String? materialId;
  final quantity = TextEditingController();
  void dispose() => quantity.dispose();
}

class RecipeForm extends StatefulWidget {
  const RecipeForm({required this.api, this.recipeId, super.key});
  final ErpApi api; final String? recipeId;
  @override
  State<RecipeForm> createState() => _RecipeFormState();
}
class _RecipeFormState extends State<RecipeForm> {
  final name = TextEditingController();
  final lines = <_RecipeLine>[_RecipeLine()];
  late Future<List<Json>> materials = rowsAsync('/api/materials');
  late Future<List<Json>> variants = rowsAsync('/api/mobile/catalog');
  Future<List<Json>> rowsAsync(String path) async => rows(await widget.api.get(path));
  String? variantId;
  bool busy = false;
  @override
  void dispose() { name.dispose(); for (final l in lines) { l.dispose(); } super.dispose(); }
  Future<void> submit() async {
    final stock = await materials;
    if (lines.any((line) => line.materialId == null || (double.tryParse(line.quantity.text) ?? 0) <= 0) ||
        lines.map((line) => line.materialId).toSet().length != lines.length ||
        (widget.recipeId == null && (variantId == null || name.text.trim().isEmpty))) return;
    setState(() => busy = true);
    final entries = lines.map((line) {
      final material = stock.firstWhere((m) => m['id'] == line.materialId);
      return {'materialId': line.materialId, 'quantity': double.parse(line.quantity.text),
        'unit': material['unit']};
    }).toList();
    try {
      if (widget.recipeId != null) {
        await perform(context, () => widget.api.post('/api/recipes/${widget.recipeId}/versions', {'items': entries}));
      } else {
        await perform(context, () => widget.api.post('/api/recipes',
          {'variantId': variantId, 'name': name.text.trim(), 'items': entries}));
      }
      if (mounted) Navigator.pop(context, true);
    } catch (_) { /* Error shown by helper. */ }
    finally { if (mounted) setState(() => busy = false); }
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<List<Json>>(future: materials,
    builder: (context, materialSnapshot) => FormScaffold(
      title: widget.recipeId == null ? 'إضافة وصفة' : 'نسخة وصفة جديدة',
      busy: busy, onSubmit: submit, children: [
        if (widget.recipeId == null) ...[
          FutureBuilder<List<Json>>(future: variants, builder: (context, snapshot) =>
            snapshot.hasData ? DropdownButtonFormField<String>(value: variantId,
              decoration: const InputDecoration(labelText: 'المنتج والحجم'),
              items: snapshot.data!.map((v) => DropdownMenuItem(value: str(v['id']),
                child: Text(str(v['title'])))).toList(),
              onChanged: (value) => setState(() => variantId = value))
              : const LinearProgressIndicator()),
          field('اسم الوصفة', name),
        ],
        if (materialSnapshot.hasError) Text('تعذر تحميل الخامات: ${materialSnapshot.error}'),
        if (materialSnapshot.hasData) ...[
          for (var i = 0; i < lines.length; i++) Card(child: Column(children: [
            DropdownButtonFormField<String>(value: lines[i].materialId,
              decoration: const InputDecoration(labelText: 'الخامة'),
              items: materialSnapshot.data!.map((m) => DropdownMenuItem(
                value: str(m['id']), child: Text('${m['name']} · ${m['unit']}'))).toList(),
              onChanged: (value) => setState(() => lines[i].materialId = value)),
            field('الكمية', lines[i].quantity, type: TextInputType.number),
            if (lines.length > 1) TextButton(onPressed: () => setState(() => lines.removeAt(i).dispose()),
              child: const Text('إزالة الخامة')),
          ])),
          TextButton.icon(onPressed: () => setState(() => lines.add(_RecipeLine())),
            icon: const Icon(Icons.add), label: const Text('إضافة خامة')),
        ],
      ]));
}
