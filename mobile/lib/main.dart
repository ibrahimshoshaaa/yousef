import 'package:flutter/material.dart';

import 'api.dart';
import 'finance.dart';
import 'inventory.dart';
import 'more.dart';
import 'orders.dart';
import 'products.dart';
import 'recipes.dart';
import 'ui.dart';

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
  final scaffoldKey = GlobalKey<ScaffoldState>();
  late Future<dynamic> account = widget.api.get('/api/mobile/me');

  void switchTo(int index) => setState(() => selected = index);

  @override
  Widget build(BuildContext context) {
    const titles = ['الرئيسية', 'الطلبات', 'المخزون', 'المنتجات', 'المصروفات',
      'المرتجعات', 'الوصفات', 'الاستهلاك', 'التقارير', 'الإعدادات', 'Shopify'];
    const icons = [Icons.dashboard_outlined, Icons.receipt_long_outlined,
      Icons.warehouse_outlined, Icons.inventory_2_outlined, Icons.payments_outlined,
      Icons.undo_outlined, Icons.science_outlined, Icons.trending_down_outlined,
      Icons.bar_chart_outlined, Icons.settings_outlined, Icons.store_outlined];
    return FutureBuilder<dynamic>(future: account, builder: (context, snapshot) {
      if (!snapshot.hasData) return Scaffold(body: Center(child: snapshot.hasError
        ? Column(mainAxisSize: MainAxisSize.min, children: [Text('${snapshot.error}'),
          TextButton(onPressed: () => setState(() => account = widget.api.get('/api/mobile/me')),
            child: const Text('إعادة المحاولة')),
          TextButton(onPressed: widget.onLogout, child: const Text('تسجيل الدخول مجددًا'))])
        : const CircularProgressIndicator()));
      final user = json(snapshot.data['data']);
      final role = str(user['role']);
      final manager = role == 'OWNER' || role == 'MANAGER';
      final owner = role == 'OWNER';
      final visible = [0, 1, 2, if (manager) 3, if (manager) 4, if (manager) 5,
        if (manager) 6, 7, if (manager) 8, 9, if (owner) 10];
      Widget body = switch (selected) {
        0 => _Dashboard(api: widget.api, user: user, onSelect: switchTo,
          manager: manager),
        1 => OrdersPage(api: widget.api, canWrite: manager),
        2 => InventoryPage(api: widget.api, canWrite: manager),
        3 => ProductsPage(api: widget.api, canWrite: manager, canShopify: owner),
        4 => ExpensesPage(api: widget.api, canWrite: manager),
        5 => ReturnsPage(api: widget.api, canWrite: manager),
        6 => RecipesPage(api: widget.api, canWrite: manager),
        7 => ConsumptionPage(api: widget.api),
        8 => ReportsPage(api: widget.api),
        9 => SettingsPage(api: widget.api, isOwner: owner),
        _ => ShopifyPage(api: widget.api),
      };
      return Scaffold(
        key: scaffoldKey,
        appBar: AppBar(title: Text(titles[selected]), actions: [
          IconButton(icon: const Icon(Icons.logout), tooltip: 'تسجيل الخروج',
            onPressed: () async { try { await widget.api.logout(); }
              finally { widget.onLogout(); } }),
        ]),
        drawer: Drawer(child: SafeArea(child: ListView(children: [
          const DrawerHeader(child: Center(child: Text('Perfume ERP'))),
          for (final i in visible) ListTile(leading: Icon(icons[i]),
            title: Text(titles[i]), selected: selected == i,
            onTap: () { Navigator.pop(context); switchTo(i); }),
        ]))),
        body: KeyedSubtree(key: ValueKey(selected), child: body),
        bottomNavigationBar: NavigationBar(
          selectedIndex: selected < 3 ? selected : 3,
          onDestinationSelected: (index) => index == 3
            ? scaffoldKey.currentState?.openDrawer() : switchTo(index),
          destinations: [
            for (final i in [0, 1, 2]) NavigationDestination(icon: Icon(icons[i]), label: titles[i]),
            const NavigationDestination(icon: Icon(Icons.menu), label: 'المزيد'),
          ]),
      );
    });
  }
}

class _Dashboard extends StatelessWidget {
  const _Dashboard({required this.api, required this.user,
    required this.onSelect, required this.manager});
  final ErpApi api;
  final Json user;
  final ValueChanged<int> onSelect;
  final bool manager;
  @override
  Widget build(BuildContext context) => FutureBuilder<dynamic>(
    future: api.get('/api/mobile/home'), builder: (context, snapshot) {
      if (!snapshot.hasData) return Center(child: snapshot.hasError
        ? Text('تعذر تحميل لوحة التحكم: ${snapshot.error}')
        : const CircularProgressIndicator());
      final data = json(snapshot.data['data']);
      return ListView(padding: const EdgeInsets.all(16), children: [
        Card(child: ListTile(title: Text('أهلًا ${str(user['name']).isEmpty ? user['email'] : user['name']}'),
          subtitle: Text(str((user['store'] as Map?)?['name'])))),
        Wrap(spacing: 8, children: [
          Chip(label: Text('الطلبات: ${data['orders']}')),
          Chip(label: Text('الخامات: ${data['materials']}')),
          if (data['pendingReturns'] != null) Chip(label: Text('مرتجعات معلقة: ${data['pendingReturns']}')),
        ]),
        Text('وصول سريع', style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 8),
        Wrap(spacing: 8, runSpacing: 8, children: [
          if (manager) FilledButton.icon(onPressed: () => openPage(context, NewOrderPage(api: api)),
            icon: const Icon(Icons.add), label: const Text('تسجيل طلب')),
          if (manager) OutlinedButton(onPressed: () => openPage(context, StockForm(api: api)),
            child: const Text('إضافة مخزون')),
          if (manager) OutlinedButton(onPressed: () => openPage(context, ExpenseForm(api: api)),
            child: const Text('إضافة مصروف')),
          OutlinedButton(onPressed: () => onSelect(1), child: const Text('الطلبات')),
          OutlinedButton(onPressed: () => onSelect(2), child: const Text('المخزون')),
          if (manager) OutlinedButton(onPressed: () => onSelect(5), child: const Text('المرتجعات')),
        ]),
      ]);
    });
}
