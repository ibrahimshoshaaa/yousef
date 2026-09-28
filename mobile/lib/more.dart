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
  late Future<dynamic> report = load();
  Future<dynamic> load() => widget.api.get('/api/reports?period=$period');
  void choose(String value) => setState(() { period = value; report = load(); });
  @override
  Widget build(BuildContext context) => ListView(padding: const EdgeInsets.all(16), children: [
    Wrap(spacing: 8, children: const {'today': 'اليوم', 'yesterday': 'أمس',
      '7d': 'آخر ٧ أيام', '30d': 'آخر ٣٠ يوم',
      'month': 'هذا الشهر', 'lastMonth': 'الشهر الماضي'}.entries.map((entry) =>
      ChoiceChip(label: Text(entry.value), selected: period == entry.key,
        onSelected: (_) => choose(entry.key))).toList()),
    FutureBuilder<dynamic>(future: report, builder: (context, snapshot) {
      if (!snapshot.hasData) return Center(child: snapshot.hasError
        ? TextButton(onPressed: () => choose(period), child: Text('${snapshot.error} · إعادة المحاولة'))
        : const CircularProgressIndicator());
      final data = json(snapshot.data['data']);
      return Column(children: data.entries.map((entry) => Card(child: ExpansionTile(
        title: Text(entry.key),
        subtitle: entry.value is num || entry.value is String
          ? Text(str(entry.value)) : null,
        children: [if (entry.value is Map) ...json(entry.value).entries.map((item) =>
          ListTile(title: Text(item.key), subtitle: Text(str(item.value))))
          else if (entry.value is List) ...((entry.value as List).take(50)).map((item) =>
          ListTile(title: Text(str(item))))],
      ))).toList());
    }),
  ]);
}

class ConsumptionPage extends StatelessWidget {
  const ConsumptionPage({required this.api, super.key});
  final ErpApi api;
  @override
  Widget build(BuildContext context) => DataView(api: api, path: '/api/consumption?limit=100',
    item: (context, entry, reload) => Card(child: ExpansionTile(
      title: Text('طلب #${str((entry['order'] as Map?)?['orderNumber'])}'),
      subtitle: Text('${str(entry['createdAt'])} · ${str(entry['status'])}'),
      children: [for (final line in (entry['items'] as List? ?? []).map(json))
        ListTile(title: Text(str((line['material'] as Map?)?['name'])),
          subtitle: Text('${str(line['quantity'])} ${str(line['unit'])}'))],
    )));
}

class SettingsPage extends StatefulWidget {
  const SettingsPage({required this.api, required this.isOwner, super.key});
  final ErpApi api;
  final bool isOwner;
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
    FutureBuilder<dynamic>(future: current, builder: (context, snapshot) {
      if (!snapshot.hasData) return const LinearProgressIndicator();
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
        field('المبلغ (EGP)', amount, type: TextInputType.number),
        SwitchListTile(title: const Text('إظهار التكلفة التقديرية'),
          value: costing, onChanged: widget.isOwner ? (value) => setState(() => costing = value) : null),
        if (widget.isOwner) FilledButton(onPressed: () async {
          final value = double.tryParse(amount.text);
          if (value == null || value < 0 || name.text.trim().length < 2) return;
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
    FutureBuilder<dynamic>(future: status, builder: (context, snapshot) {
      if (!snapshot.hasData) return Center(child: snapshot.hasError
        ? Text('${snapshot.error}') : const CircularProgressIndicator());
      final data = json(snapshot.data['data']);
      return Card(child: Column(children: [
        ListTile(title: const Text('متجر Shopify'), subtitle: Text(str(data['shopDomain'] ?? data['shop']))),
        ListTile(title: const Text('حالة الربط'), subtitle: Text(str(data['status']))),
        FilledButton(onPressed: () async {
          try { await perform(context, () => widget.api.post('/api/shopify/sync', {}), success: 'اكتملت المزامنة'); reload(); }
          catch (_) { /* Error shown by helper. */ }
        }, child: const Text('مزامنة الآن')),
        TextButton(onPressed: () => launchUrl(
          Uri.parse('https://yousef-beryl.vercel.app/dashboard/shopify'),
          mode: LaunchMode.externalApplication), child: const Text('إدارة الربط من المتصفح')),
      ]));
    }),
  ]);
}
