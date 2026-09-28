import 'package:flutter/material.dart';

import 'api.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const PerfumeErpApp());
}

class PerfumeErpApp extends StatefulWidget {
  const PerfumeErpApp({super.key});

  @override
  State<PerfumeErpApp> createState() => _PerfumeErpAppState();
}

class _PerfumeErpAppState extends State<PerfumeErpApp> {
  final api = ErpApi();
  bool? signedIn;

  @override
  void initState() {
    super.initState();
    api.hasSession.then((value) {
      if (mounted) setState(() => signedIn = value);
    });
  }

  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'Perfume ERP',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xff253d36)),
          scaffoldBackgroundColor: const Color(0xfff5f6f8),
          useMaterial3: true,
        ),
        builder: (context, child) => Directionality(
          textDirection: TextDirection.rtl,
          child: child!,
        ),
        home: signedIn == null
            ? const Scaffold(body: Center(child: CircularProgressIndicator()))
            : signedIn!
                ? ErpHome(api: api, onLogout: () => setState(() => signedIn = false))
                : LoginPage(api: api, onLogin: () => setState(() => signedIn = true)),
      );
}

class LoginPage extends StatefulWidget {
  const LoginPage({required this.api, required this.onLogin, super.key});
  final ErpApi api;
  final VoidCallback onLogin;

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final email = TextEditingController();
  final password = TextEditingController();
  bool busy = false;
  String? error;

  @override
  void dispose() {
    email.dispose();
    password.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    setState(() { busy = true; error = null; });
    try {
      await widget.api.login(email.text, password.text);
      if (mounted) widget.onLogin();
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        body: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Card(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    const Icon(Icons.spa, size: 48),
                    const SizedBox(height: 12),
                    Text('Perfume ERP', style: Theme.of(context).textTheme.headlineMedium),
                    const SizedBox(height: 24),
                    TextField(controller: email, keyboardType: TextInputType.emailAddress,
                      autofillHints: const [AutofillHints.email],
                      decoration: const InputDecoration(labelText: 'البريد الإلكتروني')),
                    TextField(controller: password, obscureText: true,
                      autofillHints: const [AutofillHints.password],
                      onSubmitted: (_) => busy ? null : submit(),
                      decoration: const InputDecoration(labelText: 'كلمة المرور')),
                    if (error != null) Padding(padding: const EdgeInsets.only(top: 12),
                      child: Text(error!, style: TextStyle(color: Theme.of(context).colorScheme.error))),
                    const SizedBox(height: 24),
                    FilledButton(onPressed: busy ? null : submit,
                      child: busy ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                                  : const Text('تسجيل الدخول')),
                  ]),
                ),
              ),
            ),
          ),
        ),
      );
}

class ErpHome extends StatefulWidget {
  const ErpHome({required this.api, required this.onLogout, super.key});
  final ErpApi api;
  final VoidCallback onLogout;

  @override
  State<ErpHome> createState() => _ErpHomeState();
}

class _ErpHomeState extends State<ErpHome> {
  int selected = 0;
  late Future<dynamic> contents = load();

  Future<dynamic> load() => widget.api.get(switch (selected) {
        0 => '/api/mobile/me',
        1 => '/api/mobile/orders',
        2 => '/api/products',
        3 => '/api/materials',
        _ => '/api/expenses',
      });

  void switchTo(int index) => setState(() { selected = index; contents = load(); });

  @override
  Widget build(BuildContext context) {
    const titles = ['الرئيسية', 'الطلبات', 'المنتجات', 'المخزون', 'المصروفات'];
    return Scaffold(
      appBar: AppBar(title: Text(titles[selected]), actions: [
        IconButton(icon: const Icon(Icons.refresh), tooltip: 'تحديث', onPressed: () => setState(() => contents = load())),
        IconButton(icon: const Icon(Icons.logout), tooltip: 'تسجيل الخروج', onPressed: () async {
          try { await widget.api.logout(); } finally { widget.onLogout(); }
        }),
      ]),
      body: FutureBuilder<dynamic>(
        future: contents,
        builder: (context, snapshot) {
          if (!snapshot.hasData && !snapshot.hasError) return const Center(child: CircularProgressIndicator());
          if (snapshot.hasError) return Center(child: Padding(padding: const EdgeInsets.all(24),
              child: Text('تعذر تحميل البيانات: ${snapshot.error}')));
          final result = snapshot.data as Map<String, dynamic>;
          final data = result['data'];
          if (selected == 0 && data is Map) {
            return ListView(padding: const EdgeInsets.all(16), children: [
              Card(child: ListTile(title: Text('أهلًا ${data['name'] ?? data['email']}'),
                  subtitle: Text((data['store'] as Map)['name']?.toString() ?? ''))),
              for (var i = 1; i < titles.length; i++)
                Card(child: ListTile(title: Text(titles[i]), trailing: const Icon(Icons.chevron_left),
                    onTap: () => switchTo(i))),
            ]);
          }
          final entries = data is List ? data : <dynamic>[];
          if (entries.isEmpty) return const Center(child: Text('لا توجد بيانات لعرضها'));
          return ListView.builder(
            padding: const EdgeInsets.all(12), itemCount: entries.length,
            itemBuilder: (context, index) {
              final item = entries[index] as Map<String, dynamic>;
              final title = selected == 1 ? item['orderNumber'] : item['title'] ?? item['name'];
              final detail = selected == 1 ? '${item['customerRef'] ?? ''} · ${item['total'] ?? ''} ${item['currency'] ?? ''}'
                  : item['unit'] ?? item['description'] ?? '';
              return Card(child: ExpansionTile(title: Text(title?.toString() ?? '—'),
                subtitle: Text(detail.toString()),
                children: [Padding(padding: const EdgeInsets.all(16),
                  child: Text(item.entries.where((entry) => entry.value != null)
                    .map((entry) => '${entry.key}: ${entry.value}').join('\n')))]));
            },
          );
        },
      ),
      bottomNavigationBar: NavigationBar(selectedIndex: selected, onDestinationSelected: switchTo,
        destinations: const [
          NavigationDestination(icon: Icon(Icons.dashboard_outlined), label: 'الرئيسية'),
          NavigationDestination(icon: Icon(Icons.receipt_long_outlined), label: 'الطلبات'),
          NavigationDestination(icon: Icon(Icons.inventory_2_outlined), label: 'المنتجات'),
          NavigationDestination(icon: Icon(Icons.warehouse_outlined), label: 'المخزون'),
          NavigationDestination(icon: Icon(Icons.payments_outlined), label: 'المصروفات'),
        ]),
    );
  }
}
