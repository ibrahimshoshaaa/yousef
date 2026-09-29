import 'package:flutter/material.dart';
import 'package:uuid/uuid.dart';

import 'api.dart';
import 'recipes.dart';
import 'ui.dart';

class ProductsPage extends StatelessWidget {
  const ProductsPage({required this.api, required this.canWrite, required this.canShopify, super.key});
  final ErpApi api;
  final bool canWrite;
  final bool canShopify;

  @override
  Widget build(BuildContext context) => DataView(api: api, path: '/api/products',
    title: 'المنتجات', subtitle: 'الأحجام والوصفات وربط Shopify', icon: Icons.inventory_2_outlined,
    action: canWrite ? (context, reload) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      SizedBox(height: 52, child: FilledButton.icon(onPressed: () async {
        final saved = await openPage<bool>(context, SimpleProductPage(api: api));
        if (saved == true) reload();
      }, icon: const Icon(Icons.add_circle_outline), label: const Text('إضافة منتج بوصفة'))),
      const SizedBox(height: 8),
      Align(alignment: AlignmentDirectional.centerStart, child: TextButton.icon(onPressed: () async {
        final saved = await openPage<bool>(context, ProductForm(api: api));
        if (saved == true) reload();
      }, icon: const Icon(Icons.tune), label: const Text('إضافة منتج بأحجام متعددة'))),
    ]) : null,
    item: (context, product, reload) => Card(margin: const EdgeInsets.only(bottom: 14),
      child: ListTile(contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
      leading: Container(width: 44, height: 44, alignment: Alignment.center,
        decoration: BoxDecoration(color: const Color(0xffe5eef3),
          borderRadius: BorderRadius.circular(13)),
        child: const Icon(Icons.inventory_2_outlined, color: appNavy)),
      title: Text(str(product['title']), style: const TextStyle(
        fontSize: 17, fontWeight: FontWeight.w800)),
      subtitle: Padding(padding: const EdgeInsets.only(top: 6), child: Text(
        '${(product['variants'] as List?)?.length ?? 0} أحجام · '
        '${product['shopifyId'] == null ? 'محلي' : 'مرتبط بـ Shopify'}')),
      trailing: const Icon(Icons.chevron_left, color: appNavy),
      onTap: () async { await openPage(context, ProductDetail(api: api,
        product: product, canWrite: canWrite, canShopify: canShopify)); reload(); },
    )));
}

class _Ingredient {
  String? materialId;
  final quantity = TextEditingController();
  void dispose() => quantity.dispose();
}

class SimpleProductPage extends StatefulWidget {
  const SimpleProductPage({required this.api, super.key});
  final ErpApi api;
  @override
  State<SimpleProductPage> createState() => _SimpleProductPageState();
}

class _SimpleProductPageState extends State<SimpleProductPage> {
  final name = TextEditingController();
  final price = TextEditingController();
  final ingredients = <_Ingredient>[_Ingredient()];
  final requestId = const Uuid().v4();
  late Future<List<Json>> materials = loadMaterials();
  Future<List<Json>> loadMaterials() async => rows(await widget.api.get('/api/materials'));
  bool busy = false;
  @override
  void dispose() {
    name.dispose(); price.dispose();
    for (final line in ingredients) { line.dispose(); }
    super.dispose();
  }

  Future<void> submit() async {
    final value = double.tryParse(price.text);
    if (name.text.trim().isEmpty || value == null || value <= 0 ||
      ingredients.any((line) => line.materialId == null ||
        (double.tryParse(line.quantity.text) ?? 0) <= 0) ||
      ingredients.map((line) => line.materialId).toSet().length != ingredients.length) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('راجع اسم العطر والسعر والخامات والكميات')));
      return;
    }
    setState(() => busy = true);
    try {
      await perform(context, () => widget.api.post('/api/products/simple', {
        'requestId': requestId, 'name': name.text.trim(), 'price': value,
        'materials': ingredients.map((line) => {
          'materialId': line.materialId, 'quantity': double.parse(line.quantity.text),
        }).toList(),
      }), success: 'تم حفظ العطر ووصفته');
      if (mounted) Navigator.pop(context, true);
    } catch (_) { /* Error shown by helper. */ }
    finally { if (mounted) setState(() => busy = false); }
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<List<Json>>(future: materials,
    builder: (context, snapshot) => FormScaffold(title: 'إضافة منتج بوصفة', busy: busy,
      onSubmit: submit, children: [
        field('اسم العطر وحجمه', name),
        field('سعر البيع (EGP)', price, type: TextInputType.number),
        const Padding(padding: EdgeInsets.symmetric(vertical: 12),
          child: Text('الخامات المطلوبة للعطر الواحد؛ تُخصم عند البيع')),
        if (snapshot.hasError) Text('تعذر تحميل الخامات: ${snapshot.error}'),
        if (snapshot.hasData) ...[
          if (snapshot.data!.isEmpty) const ListTile(title: Text('أضف خامات للمخزون أولًا')),
          for (var i = 0; i < ingredients.length; i++) Card(child: Padding(
            padding: const EdgeInsets.all(12), child: Column(children: [
              DropdownButtonFormField<String>(value: ingredients[i].materialId,
                decoration: const InputDecoration(labelText: 'الخامة'),
                items: snapshot.data!.map((m) => DropdownMenuItem(value: str(m['id']),
                  child: Text('${m['name']} (${m['unit']})'))).toList(),
                onChanged: (value) => setState(() => ingredients[i].materialId = value)),
              field('الكمية', ingredients[i].quantity, type: TextInputType.number),
              if (ingredients.length > 1) TextButton(onPressed: () => setState(() => ingredients.removeAt(i).dispose()),
                child: const Text('إزالة الخامة')),
            ]))),
          TextButton.icon(onPressed: ingredients.length >= 30 ? null
            : () => setState(() => ingredients.add(_Ingredient())),
            icon: const Icon(Icons.add), label: const Text('خامة أخرى')),
        ],
      ]));
}

class ProductForm extends StatefulWidget {
  const ProductForm({required this.api, super.key});
  final ErpApi api;
  @override
  State<ProductForm> createState() => _ProductFormState();
}

class _ProductFormState extends State<ProductForm> {
  final title = TextEditingController();
  final variant = TextEditingController();
  final sku = TextEditingController();
  final price = TextEditingController();
  bool busy = false;
  @override
  void dispose() { title.dispose(); variant.dispose(); sku.dispose(); price.dispose(); super.dispose(); }
  Future<void> save() async {
    if (title.text.trim().isEmpty || variant.text.trim().isEmpty ||
        (double.tryParse(price.text) ?? -1) < 0) {
      showMessage(context, 'راجع اسم المنتج والحجم والسعر'); return;
    }
    setState(() => busy = true);
    try {
      await widget.api.post('/api/mobile/products', {
        'title': title.text.trim(), 'variantTitle': variant.text.trim(),
        'sku': sku.text.trim(), 'price': double.parse(price.text),
      });
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    } finally { if (mounted) setState(() => busy = false); }
  }
  @override
  Widget build(BuildContext context) => FormScaffold(title: 'إضافة منتج', busy: busy,
    onSubmit: save, children: [const Text('أضف الوصفة بعد حفظ المنتج ليتم خصم خاماته عند البيع.'),
      field('اسم المنتج', title), field('الحجم', variant),
      field('SKU', sku), field('السعر (EGP)', price, type: TextInputType.number)]);
}

class ProductDetail extends StatefulWidget {
  const ProductDetail({required this.api, required this.product,
    required this.canWrite, required this.canShopify, super.key});
  final ErpApi api;
  final Json product;
  final bool canWrite;
  final bool canShopify;
  @override
  State<ProductDetail> createState() => _ProductDetailState();
}

class _ProductDetailState extends State<ProductDetail> {
  late Future<Json> detail = fetch();
  Future<Json> fetch() async => json((await widget.api.get('/api/products/${widget.product['id']}'))['data']);
  void reload() => setState(() => detail = fetch());

  Future<void> archive(Json product) async {
    final linked = product['shopifyId'] != null;
    if (!await confirm(context, linked
      ? 'إخفاء المنتج من ERP ومن الطلبات الجديدة؟ سيظل منشورًا في Shopify حتى توقف نشره من المتجر.'
      : 'إخفاء المنتج من القائمة والطلبات الجديدة؟ ستبقى بيانات الطلبات السابقة محفوظة.')) return;
    try {
      await perform(context, () => widget.api.delete('/api/products/${product['id']}'),
        success: 'تمت أرشفة المنتج');
      if (mounted) Navigator.pop(context, true);
    } catch (_) { /* Error shown by helper. */ }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(str(widget.product['title']))),
    body: FutureBuilder<Json>(future: detail, builder: (context, snapshot) {
      if (!snapshot.hasData) return snapshot.hasError
        ? Center(child: TextButton(onPressed: reload, child: const Text('تعذر التحميل · إعادة المحاولة')))
        : const PageSkeleton();
      final product = snapshot.data!;
      return RefreshIndicator(onRefresh: () async { reload(); await detail; },
        child: ListView(padding: const EdgeInsets.all(16), children: [
      PageIntro(title: str(product['title']), subtitle: 'الأحجام والوصفات وحالة النشر', icon: Icons.inventory_2_outlined),
      const SizedBox(height: 16),
      Card(child: Padding(padding: const EdgeInsets.all(18), child: Column(
        crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('حالة المنتج', style: TextStyle(fontSize: 16,
          fontWeight: FontWeight.w800, color: appInk)),
        const SizedBox(height: 10),
        StatusPill(label: product['shopifyId'] == null ? 'محلي · غير منشور' :
          'مرتبط بـ Shopify', color: product['shopifyId'] == null ? appMuted : appNavy),
        const SizedBox(height: 8),
        Text('${(product['variants'] as List).length} أحجام',
          style: const TextStyle(color: appMuted)),
      ]))),
      const SizedBox(height: 14),
      if (widget.canShopify && product['shopifyId'] == null) SizedBox(
        width: double.infinity, child: FilledButton.icon(
        onPressed: () async {
          if (!await confirm(context, 'نشر المنتج في Shopify؟ الخدمة تدعم منتجًا بحجم واحد.')) return;
          try { await perform(context, () => widget.api.post('/api/products/${product['id']}/publish-shopify', {})); reload(); }
          catch (_) { /* Error shown by helper. */ }
        }, icon: const Icon(Icons.cloud_upload_outlined), label: const Text('نشر في Shopify'))),
      const SizedBox(height: 20),
      const Text('الأحجام والوصفات', style: TextStyle(fontSize: 19,
        fontWeight: FontWeight.w800, color: appInk)),
      const SizedBox(height: 12),
      for (final v in (product['variants'] as List).map(json)) Card(
        margin: const EdgeInsets.only(bottom: 14), child: ExpansionTile(
        tilePadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
        childrenPadding: const EdgeInsets.fromLTRB(18, 0, 18, 18),
        title: Text(str(v['title']), style: const TextStyle(fontSize: 17,
          fontWeight: FontWeight.w800)),
        subtitle: Padding(padding: const EdgeInsets.only(top: 5),
          child: Text('${str(v['price'])} EGP${str(v['sku']).isEmpty ? '' : ' · ${str(v['sku'])}'}')),
        children: [
          const Divider(),
          if (v['costing'] is Map && (v['costing'] as Map)['estimatedCost'] != null)
            ListTile(title: const Text('تكلفة التصنيع المقدرة'),
              trailing: Text('${(v['costing'] as Map)['estimatedCost']} EGP')),
          if (v['recipes'] is List && (v['recipes'] as List).isNotEmpty) ...[
            const Align(alignment: AlignmentDirectional.centerStart,
              child: Text('الوصفة الحالية', style: TextStyle(
                fontWeight: FontWeight.w800, color: appInk))),
            const SizedBox(height: 8),
            for (final recipe in (v['recipes'] as List).map(json)) ...[
              for (final version in (recipe['versions'] as List).map(json))
                for (final item in (version['items'] as List).map(json))
                  ListTile(dense: true,
                    title: Text(str((item['material'] as Map?)?['name'])),
                    trailing: Text('${str(item['quantity'])} ${str(item['unit'])}')),
              if (widget.canWrite) SizedBox(width: double.infinity,
                child: OutlinedButton.icon(onPressed: () async {
                  final saved = await openPage<bool>(context, RecipeForm(
                    api: widget.api, recipeId: str(recipe['id'])));
                  if (saved == true) reload();
                }, icon: const Icon(Icons.edit_outlined),
                  label: const Text('تعديل الوصفة'))),
              const SizedBox(height: 8),
            ],
          ],
          if (widget.canWrite && (v['recipes'] is! List || (v['recipes'] as List).isEmpty))
            SizedBox(width: double.infinity, child: OutlinedButton.icon(
              icon: const Icon(Icons.add), label: const Text('إضافة وصفة لهذا الحجم'),
              onPressed: () async { final saved = await openPage<bool>(context,
                RecipeForm(api: widget.api, initialVariantId: str(v['id']))); if (saved == true) reload(); })),
        ],
      )),
      if (widget.canWrite) SizedBox(width: double.infinity,
        child: OutlinedButton.icon(onPressed: () async {
        final saved = await openPage<bool>(context,
          VariantForm(api: widget.api, productId: str(product['id'])));
        if (saved == true) reload();
      },
        icon: const Icon(Icons.add), label: const Text('إضافة حجم'))),
      if (widget.canWrite) ...[
        const SizedBox(height: 24),
        const Divider(),
        TextButton.icon(onPressed: () => archive(product),
          icon: const Icon(Icons.delete_outline), label: const Text('حذف المنتج من ERP'),
          style: TextButton.styleFrom(foregroundColor: const Color(0xffa33146))),
      ],
    ]));
    }),
  );
}

class VariantForm extends StatefulWidget {
  const VariantForm({required this.api, required this.productId, super.key});
  final ErpApi api;
  final String productId;
  @override
  State<VariantForm> createState() => _VariantFormState();
}
class _VariantFormState extends State<VariantForm> {
  final title = TextEditingController(); final price = TextEditingController();
  bool busy = false;
  @override
  void dispose() { title.dispose(); price.dispose(); super.dispose(); }
  Future<void> save() async {
    final value = double.tryParse(price.text);
    if (value == null || value < 0 || title.text.trim().isEmpty) {
      showMessage(context, 'راجع الحجم والسعر'); return;
    }
    setState(() => busy = true);
    try {
      await perform(context, () => widget.api.post('/api/products/${widget.productId}/variants',
        {'title': title.text.trim(), 'price': value}));
      if (mounted) Navigator.pop(context, true);
    } catch (_) { /* Error shown by helper. */ }
    finally { if (mounted) setState(() => busy = false); }
  }
  @override
  Widget build(BuildContext context) => FormScaffold(title: 'إضافة حجم', busy: busy,
    onSubmit: save, children: [field('الحجم', title), field('السعر', price, type: TextInputType.number)]);
}
