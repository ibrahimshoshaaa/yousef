import 'package:flutter/material.dart';

import 'api.dart';
import 'ui.dart';

class ProductsPage extends StatelessWidget {
  const ProductsPage({required this.api, required this.canWrite, required this.canShopify, super.key});
  final ErpApi api;
  final bool canWrite;
  final bool canShopify;

  @override
  Widget build(BuildContext context) => DataView(api: api, path: '/api/products',
    action: canWrite ? (context, reload) => FilledButton.icon(onPressed: () async {
      final saved = await openPage<bool>(context, ProductForm(api: api));
      if (saved == true) reload();
    }, icon: const Icon(Icons.add), label: const Text('إضافة منتج')) : null,
    item: (context, product, reload) => Card(child: ListTile(
      title: Text(str(product['title'])),
      subtitle: Text('${(product['variants'] as List?)?.length ?? 0} أحجام'),
      trailing: const Icon(Icons.chevron_left),
      onTap: () async { await openPage(context, ProductDetail(api: api,
        product: product, canWrite: canWrite, canShopify: canShopify)); reload(); },
    )));
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
        (double.tryParse(price.text) ?? -1) < 0) return;
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
    onSubmit: save, children: [field('اسم المنتج', title), field('الحجم', variant),
      field('SKU', sku), field('السعر (EGP)', price, type: TextInputType.number)]);
}

class ProductDetail extends StatelessWidget {
  const ProductDetail({required this.api, required this.product,
    required this.canWrite, required this.canShopify, super.key});
  final ErpApi api;
  final Json product;
  final bool canWrite;
  final bool canShopify;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(str(product['title']))),
    body: ListView(padding: const EdgeInsets.all(16), children: [
      Card(child: ListTile(title: Text(str(product['title'])),
        subtitle: Text('معرّف Shopify: ${str(product['shopifyId']).isEmpty ? 'لم يُنشر' : str(product['shopifyId'])}'))),
      if (canShopify && product['shopifyId'] == null) FilledButton.icon(
        onPressed: () async {
          if (!await confirm(context, 'نشر المنتج في Shopify؟ الخدمة تدعم منتجًا بحجم واحد.')) return;
          try { await perform(context, () => api.post('/api/products/${product['id']}/publish-shopify', {})); }
          catch (_) { /* Error shown by helper. */ }
        }, icon: const Icon(Icons.cloud_upload_outlined), label: const Text('نشر في Shopify')),
      for (final v in (product['variants'] as List).map(json)) Card(child: ExpansionTile(
        title: Text(str(v['title'])), subtitle: Text('${str(v['price'])} EGP · ${str(v['sku'])}'),
        children: [
          if (v['cost'] != null) ListTile(title: const Text('تكلفة التصنيع'), subtitle: Text('${v['cost']} EGP')),
          if (v['recipes'] is List && (v['recipes'] as List).isNotEmpty)
            const ListTile(title: Text('الوصفة مسجلة'), trailing: Icon(Icons.check_circle_outline)),
        ],
      )),
      if (canWrite) OutlinedButton.icon(onPressed: () => openPage(context,
        VariantForm(api: api, productId: str(product['id']))),
        icon: const Icon(Icons.add), label: const Text('إضافة حجم')),
    ]),
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
    if (value == null || value < 0 || title.text.trim().isEmpty) return;
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
