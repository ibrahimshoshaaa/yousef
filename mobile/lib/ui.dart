import 'package:flutter/material.dart';

import 'api.dart';

typedef Json = Map<String, dynamic>;

Json json(dynamic data) => Map<String, dynamic>.from(data as Map);
List<Json> rows(dynamic response) =>
    ((response as Map)['data'] as List).map(json).toList();
String str(dynamic value) => value?.toString() ?? '';
double amount(dynamic value) => double.tryParse(str(value)) ?? 0;

const appNavy = Color(0xff123e57);
const appInk = Color(0xff172c3c);
const appMuted = Color(0xff657381);
const appCanvas = Color(0xfff5f6fa);

void showMessage(BuildContext context, String message) {
  if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(content: Text(message), behavior: SnackBarBehavior.floating));
}

class PageIntro extends StatelessWidget {
  const PageIntro({required this.title, required this.subtitle, this.icon, super.key});
  final String title;
  final String subtitle;
  final IconData? icon;
  @override
  Widget build(BuildContext context) => Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(title, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: appInk)),
      const SizedBox(height: 3),
      Text(subtitle, style: const TextStyle(fontSize: 12, color: appMuted)),
    ])),
    if (icon != null) Container(width: 42, height: 42,
      decoration: BoxDecoration(color: const Color(0xffe5eef3), borderRadius: BorderRadius.circular(13)),
      child: Icon(icon, color: appNavy, size: 22)),
  ]);
}

class FormSection extends StatelessWidget {
  const FormSection({required this.title, this.subtitle, super.key});
  final String title;
  final String? subtitle;
  @override
  Widget build(BuildContext context) => Padding(padding: const EdgeInsets.only(bottom: 12, top: 6),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: appInk)),
      if (subtitle != null) Padding(padding: const EdgeInsets.only(top: 3),
        child: Text(subtitle!, style: const TextStyle(fontSize: 12, color: appMuted))),
    ]));
}

class StatusPill extends StatelessWidget {
  const StatusPill({required this.label, this.color = appNavy, super.key});
  final String label;
  final Color color;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
    decoration: BoxDecoration(color: color.withValues(alpha: 0.10),
      borderRadius: BorderRadius.circular(20)),
    child: Text(label, style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w700)));
}

class PageSkeleton extends StatelessWidget {
  const PageSkeleton({this.embedded = false, super.key});
  final bool embedded;
  @override
  Widget build(BuildContext context) => ListView(
    shrinkWrap: embedded,
    physics: embedded ? const NeverScrollableScrollPhysics() : null,
    padding: const EdgeInsets.all(16),
    children: [
      Align(alignment: Alignment.centerRight,
        child: Container(height: 22, width: 150,
          decoration: BoxDecoration(color: const Color(0xffe5ebef),
            borderRadius: BorderRadius.circular(9)))),
      const SizedBox(height: 18),
      for (final height in const [112.0, 92.0, 92.0])
        Container(height: height, margin: const EdgeInsets.only(bottom: 12),
          decoration: BoxDecoration(color: Colors.white,
            border: Border.all(color: const Color(0xffe8edf0)),
            borderRadius: BorderRadius.circular(18)),
          child: Padding(padding: const EdgeInsets.all(18), child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center, children: [
              Container(height: 15, width: 130, decoration: BoxDecoration(
                color: const Color(0xffe5ebef), borderRadius: BorderRadius.circular(8))),
              const SizedBox(height: 12),
              Container(height: 12, width: 200, decoration: BoxDecoration(
                color: const Color(0xffeef2f4), borderRadius: BorderRadius.circular(8))),
            ]))),
    ],
  );
}

Future<void> perform(BuildContext context, Future<dynamic> Function() action,
    {String success = 'تم الحفظ'}) async {
  try {
    await action();
    if (context.mounted) {
      showMessage(context, success);
    }
  } catch (e) {
    if (context.mounted) {
      showMessage(context, e.toString());
    }
    rethrow;
  }
}

Future<bool> confirm(BuildContext context, String message) async =>
    await showDialog<bool>(context: context, builder: (context) => AlertDialog(
      title: const Text('تأكيد العملية'), content: Text(message), actions: [
        TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('إلغاء')),
        FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('تأكيد')),
      ],
    )) ?? false;

Widget field(String label, TextEditingController controller,
    {TextInputType? type, int lines = 1, String? hint}) => Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextField(controller: controller, keyboardType: type, maxLines: lines,
        decoration: InputDecoration(labelText: label, hintText: hint,
          border: const OutlineInputBorder())),
    );

class DataView extends StatefulWidget {
  const DataView({required this.api, required this.path, required this.item,
    this.action, this.title, this.subtitle, this.icon, super.key});
  final ErpApi api;
  final String path;
  final Widget Function(BuildContext, Json, VoidCallback) item;
  final Widget Function(BuildContext, VoidCallback)? action;
  final String? title;
  final String? subtitle;
  final IconData? icon;
  @override
  State<DataView> createState() => _DataViewState();
}

class _DataViewState extends State<DataView> {
  late Future<List<Json>> future = fetch();
  Future<List<Json>> fetch() async => rows(await widget.api.get(widget.path));
  void reload() => setState(() => future = fetch());

  @override
  Widget build(BuildContext context) => FutureBuilder<List<Json>>(
    future: future,
    builder: (context, snapshot) {
      if (!snapshot.hasData && !snapshot.hasError) {
        return const PageSkeleton();
      }
      if (snapshot.hasError) {
        return Center(child: TextButton.icon(onPressed: reload,
          icon: const Icon(Icons.refresh), label: Text('تعذر التحميل: ${snapshot.error}')));
      }
      final entries = snapshot.data!;
      return RefreshIndicator(onRefresh: () async { reload(); await future; },
        child: ListView(padding: const EdgeInsets.all(16), children: [
          if (widget.title != null) ...[
            PageIntro(title: widget.title!, subtitle: widget.subtitle ?? '${entries.length} سجل', icon: widget.icon),
            const SizedBox(height: 16),
          ],
          if (widget.action != null) widget.action!(context, reload),
          if (widget.action != null) const SizedBox(height: 14),
          if (entries.isEmpty) const Padding(padding: EdgeInsets.all(28),
            child: Center(child: Text('لا توجد بيانات بعد'))),
          ...entries.map((entry) => widget.item(context, entry, reload)),
        ]));
    });
}

Future<T?> openPage<T>(BuildContext context, Widget page) =>
    Navigator.push<T>(context, MaterialPageRoute(builder: (_) => page));

class FormScaffold extends StatelessWidget {
  const FormScaffold({required this.title, required this.children, required this.onSubmit,
    this.busy = false, super.key});
  final String title;
  final List<Widget> children;
  final VoidCallback onSubmit;
  final bool busy;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(title)),
    body: ListView(padding: const EdgeInsets.fromLTRB(16, 20, 16, 18), children: [
      ...children,
      const SizedBox(height: 16),
    ]),
    bottomNavigationBar: SafeArea(top: false, child: Container(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
      decoration: const BoxDecoration(color: Colors.white,
        border: Border(top: BorderSide(color: Color(0xffe5eae6)))),
      child: FilledButton(onPressed: busy ? null : onSubmit,
        child: Padding(padding: const EdgeInsets.symmetric(vertical: 4),
          child: Text(busy ? 'جارٍ الحفظ...' : 'حفظ', style: const TextStyle(fontWeight: FontWeight.w700))))),
    ),
  );
}
