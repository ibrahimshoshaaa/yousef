import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api.dart';
import 'ui.dart';

class ReportsPage extends StatefulWidget {
  const ReportsPage({required this.api, super.key});
  final ErpApi api;
  @override
  State<ReportsPage> createState() => _ReportsPageState();
}
class _ReportsPageState extends State<ReportsPage> {
  String period = '7d';
  DateTime? from;
  DateTime? to;
  late Future<dynamic> report = load();
  String date(DateTime value) => '${value.year}-${value.month.toString().padLeft(2, '0')}-${value.day.toString().padLeft(2, '0')}';
  Future<dynamic> load() => widget.api.get(period == 'custom' && from != null && to != null
    ? '/api/reports?period=custom&from=${date(from!)}&to=${date(to!)}'
    : '/api/reports?period=$period');
  void choose(String value) => setState(() { period = value; report = load(); });
  Future<void> custom() async {
    final picked = await showDateRangePicker(context: context,
      firstDate: DateTime(2020), lastDate: DateTime.now(),
      initialDateRange: from != null && to != null ? DateTimeRange(start: from!, end: to!) : null);
    if (picked != null) setState(() {
      from = picked.start; to = picked.end; period = 'custom'; report = load();
    });
  }
  @override
  Widget build(BuildContext context) => ListView(padding: const EdgeInsets.all(16), children: [
    const PageIntro(title: 'التقارير', subtitle: 'ملخص المبيعات والتحصيل والمخزون', icon: Icons.bar_chart_rounded),
    const SizedBox(height: 16),
    Wrap(spacing: 8, children: const {'today': 'اليوم', 'yesterday': 'أمس',
      '7d': 'آخر ٧ أيام', '30d': 'آخر ٣٠ يوم',
      'month': 'هذا الشهر', 'lastMonth': 'الشهر الماضي'}.entries.map((entry) =>
      ChoiceChip(label: Text(entry.value), selected: period == entry.key,
        onSelected: (_) => choose(entry.key))).toList()),
    OutlinedButton.icon(onPressed: custom, icon: const Icon(Icons.date_range),
      label: Text(period == 'custom' && from != null && to != null
        ? '${date(from!)} – ${date(to!)}' : 'فترة مخصصة')),
    FutureBuilder<dynamic>(future: report, builder: (context, snapshot) {
      if (!snapshot.hasData) return snapshot.hasError
        ? TextButton(onPressed: () => choose(period), child: Text('${snapshot.error} · إعادة المحاولة'))
        : const PageSkeleton(embedded: true);
      final data = json(snapshot.data['data']);
      final sales = json(data['sales']);
      final cash = json(data['cash']);
      final returns = json(data['returns']);
      final expenses = json(data['expenses']);
      Widget section(String title, List<Widget> children) => Card(child: ExpansionTile(
        title: Text(title), initiallyExpanded: title == 'المبيعات', children: children));
      Widget line(String title, dynamic value) => ListTile(title: Text(title), trailing: Text(str(value)));
      Widget kpi(String label, dynamic value, IconData icon) => Card(child: Padding(
        padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start,
          children: [Icon(icon, color: appNavy, size: 21), const SizedBox(height: 12),
            Text(label, style: const TextStyle(fontSize: 12, color: appMuted)),
            const SizedBox(height: 5), Text(str(value), textDirection: TextDirection.ltr,
              style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w800, color: appInk))])));
      return Column(children: [
        const SizedBox(height: 12),
        Row(children: [Expanded(child: kpi('إجمالي المبيعات', sales['gross'], Icons.trending_up)),
          const SizedBox(width: 10), Expanded(child: kpi('صافي المبيعات', sales['net'], Icons.show_chart))]),
        const SizedBox(height: 10),
        Row(children: [Expanded(child: kpi('الدفعات المستلمة', cash['received'], Icons.account_balance_wallet_outlined)),
          const SizedBox(width: 10), Expanded(child: kpi('عدد الطلبات', sales['orders'], Icons.receipt_long_outlined))]),
        const SizedBox(height: 16),
        const FormSection(title: 'تفاصيل الفترة'),
        section('المبيعات', [
          line('الوحدات المباعة', sales['units']),
          line('متوسط الطلب', sales['averageOrderValue']),
          line('الخصومات', sales['discounts']), line('المسترد', sales['refunded']),
          line('الديبوزت', cash['deposits']),
        ]),
        section('المنتجات', [for (final product in (data['products'] as List).map(json))
          ListTile(title: Text('${product['product']} · ${product['variant']}'),
            subtitle: Text('الوحدات: ${product['units']}'), trailing: Text(str(product['net'])))]),
        section('المرتجعات', [line('عدد المرتجعات', returns['count']),
          line('قيمتها', returns['value']), line('تكلفتها', returns['costs'])]),
        section('المصروفات', [line('إجمالي المصروفات', expenses['total']),
          for (final category in (expenses['byCategory'] as List).map(json))
            line(str(category['category'] ?? category['name']), category['amount'])]),
        section('استهلاك الخامات', [for (final material in (data['consumption'] as List).map(json))
          line(str(material['name']), '${material['consumed']} ${material['unit']}')]),
        section('المخزون الحالي', [for (final material in (data['inventory'] as List).map(json))
          line(str(material['name']), '${material['stock']} ${material['unit']}')]),
      ]);
    }),
  ]);
}

class ConsumptionPage extends StatelessWidget {
  const ConsumptionPage({required this.api, this.orderId, super.key});
  final ErpApi api;
  final String? orderId;
  @override
  Widget build(BuildContext context) => DataView(api: api,
    title: 'استهلاك الخامات', subtitle: 'تفاصيل المواد المستخدمة في الطلبات', icon: Icons.science_outlined,
    path: '/api/consumption?limit=100${orderId == null ? '' : '&orderId=${Uri.encodeQueryComponent(orderId!)}'}',
    item: (context, entry, reload) => Card(child: ExpansionTile(
      title: Text('طلب #${str((entry['order'] as Map?)?['orderNumber'])}'),
      subtitle: Text('${str(entry['createdAt'])} · ${str(entry['status'])}'),
      children: [for (final line in (entry['items'] as List? ?? []).map(json))
        ListTile(title: Text(str((line['material'] as Map?)?['name'])),
          subtitle: Text('${str(line['quantity'])} ${str(line['unit'])}'))],
    )));
}

class SettingsPage extends StatefulWidget {
  const SettingsPage({required this.api, required this.isOwner, required this.onAccount, super.key});
  final ErpApi api;
  final bool isOwner;
  final VoidCallback onAccount;
  @override
  State<SettingsPage> createState() => _SettingsPageState();
}
class _SettingsPageState extends State<SettingsPage> {
  final name = TextEditingController();
  final amount = TextEditingController();
  bool costing = false;
  bool initialized = false;
  late Future<dynamic> current = widget.api.get('/api/mobile/settings');
  @override
  void dispose() { name.dispose(); amount.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) => ListView(padding: const EdgeInsets.all(16), children: [
    const PageIntro(title: 'الإعدادات', subtitle: 'الحساب وإعدادات المتجر', icon: Icons.settings_outlined),
    const SizedBox(height: 16),
    Card(child: ListTile(leading: const Icon(Icons.admin_panel_settings_outlined),
      title: const Text('الحساب والأمان'), subtitle: const Text('كلمة المرور والمستخدمون'),
      trailing: const Icon(Icons.chevron_left), onTap: widget.onAccount)),
    const SizedBox(height: 12),
    FutureBuilder<dynamic>(future: current, builder: (context, snapshot) {
      if (!snapshot.hasData) return snapshot.hasError
        ? TextButton(onPressed: () => setState(() => current = widget.api.get('/api/mobile/settings')),
            child: const Text('تعذر تحميل الإعدادات · إعادة المحاولة'))
        : const PageSkeleton(embedded: true);
      final store = json(snapshot.data['data']);
      if (!initialized) {
        initialized = true;
        name.text = str(store['name']);
        amount.text = str(store['defaultReturnCost']);
        costing = store['costingEnabled'] == true;
      }
      return Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(children: [
        field('اسم المتجر', name),
        ListTile(title: const Text('العملة'), subtitle: Text(str(store['currency']))),
        ListTile(title: const Text('المنطقة الزمنية'), subtitle: Text(str(store['timezone']))),
        field('تكلفة المرتجع الافتراضية (EGP)', amount, type: TextInputType.number),
        SwitchListTile(title: const Text('إظهار التكلفة التقديرية'),
          value: costing, onChanged: widget.isOwner ? (value) => setState(() => costing = value) : null),
        if (widget.isOwner) FilledButton(onPressed: () async {
          final value = double.tryParse(amount.text);
          if (value == null || value < 0 || name.text.trim().length < 2) {
            showMessage(context, 'راجع اسم المتجر وتكلفة المرتجع'); return;
          }
          try { await perform(context, () => widget.api.put('/api/mobile/settings',
            {'name': name.text.trim(), 'defaultReturnCost': value, 'costingEnabled': costing})); }
          catch (_) { /* Error shown by helper. */ }
        }, child: const Text('حفظ الإعدادات')),
      ])));
    }),
  ]);
}

class ShopifyPage extends StatefulWidget {
  const ShopifyPage({required this.api, super.key});
  final ErpApi api;
  @override
  State<ShopifyPage> createState() => _ShopifyPageState();
}
class _ShopifyPageState extends State<ShopifyPage> {
  late Future<dynamic> status = widget.api.get('/api/shopify/status');
  void reload() => setState(() => status = widget.api.get('/api/shopify/status'));
  @override
  Widget build(BuildContext context) => ListView(padding: const EdgeInsets.all(16), children: [
    const PageIntro(title: 'Shopify', subtitle: 'حالة الاتصال ومزامنة بيانات المتجر', icon: Icons.storefront_outlined),
    const SizedBox(height: 16),
    FutureBuilder<dynamic>(future: status, builder: (context, snapshot) {
      if (!snapshot.hasData) return snapshot.hasError
        ? TextButton(onPressed: reload, child: const Text('تعذر تحميل حالة الاتصال · إعادة المحاولة'))
        : const PageSkeleton(embedded: true);
      final data = json(snapshot.data['data']);
      final connection = data['connection'] is Map ? json(data['connection']) : data;
      final connected = connection['status'] == 'CONNECTED';
      final sync = data['syncState'] is Map ? json(data['syncState']) : const <String, dynamic>{};
      return Column(children: [
        Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(
          crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [const Icon(Icons.storefront_outlined, color: appNavy),
            const SizedBox(width: 10), Expanded(child: Text(
              str(connection['shopDomain'] ?? 'لا يوجد متجر متصل'),
              style: const TextStyle(fontWeight: FontWeight.w800))),
            StatusPill(label: connected ? 'متصل' : 'غير متصل',
              color: connected ? const Color(0xff24704a) : const Color(0xffa33146))]),
          if (sync['lastSuccessfulSyncAt'] != null) Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Text('آخر مزامنة ناجحة: ${str(sync['lastSuccessfulSyncAt'])}',
              style: const TextStyle(fontSize: 12, color: appMuted))),
        ]))),
        const SizedBox(height: 14),
        SizedBox(width: double.infinity, child: FilledButton.icon(onPressed: connected ? () async {
          try { await perform(context, () => widget.api.post('/api/shopify/sync', {}), success: 'اكتملت المزامنة'); reload(); }
          catch (_) { /* Error shown by helper. */ }
        } : null, icon: const Icon(Icons.sync), label: const Text('مزامنة الآن'))),
        TextButton(onPressed: () => launchUrl(
          Uri.parse('https://yousef-beryl.vercel.app/dashboard/shopify'),
          mode: LaunchMode.externalApplication), child: const Text('إدارة الربط من المتصفح')),
      ]);
    }),
  ]);
}
