import 'package:flutter/material.dart';

import 'api.dart';
import 'finance.dart';
import 'inventory.dart';
import 'materials.dart';
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
          colorScheme: ColorScheme.fromSeed(
            seedColor: const Color(0xff173d34),
            primary: const Color(0xff173d34),
            surface: Colors.white,
          ),
          scaffoldBackgroundColor: const Color(0xfff5f6f4),
          appBarTheme: const AppBarTheme(
            backgroundColor: Color(0xfff5f6f4),
            foregroundColor: Color(0xff142720),
            elevation: 0,
            scrolledUnderElevation: 0,
            centerTitle: false,
          ),
          cardTheme: CardThemeData(
            color: Colors.white,
            elevation: 0,
            margin: EdgeInsets.zero,
            shape: RoundedRectangleBorder(
              side: const BorderSide(color: Color(0xffe5eae6)),
              borderRadius: BorderRadius.circular(20),
            ),
          ),
          filledButtonTheme: FilledButtonThemeData(style: FilledButton.styleFrom(
            minimumSize: const Size(0, 48),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          )),
          outlinedButtonTheme: OutlinedButtonThemeData(style: OutlinedButton.styleFrom(
            minimumSize: const Size(0, 48),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          )),
          inputDecorationTheme: InputDecorationTheme(
            filled: true,
            fillColor: Colors.white,
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: Color(0xffdce4de)),
            ),
          ),
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

  void switchTo(int index) {
    if (selected != index) setState(() => selected = index);
  }

  @override
  Widget build(BuildContext context) {
    const titles = ['الرئيسية', 'الطلبات', 'المخزون', 'المنتجات', 'المصروفات',
      'المرتجعات', 'الوصفات', 'الاستهلاك', 'التقارير', 'الإعدادات', 'Shopify',
      'المواد الخام', 'الموردون'];
    const icons = [Icons.dashboard_outlined, Icons.receipt_long_outlined,
      Icons.warehouse_outlined, Icons.inventory_2_outlined, Icons.payments_outlined,
      Icons.undo_outlined, Icons.science_outlined, Icons.trending_down_outlined,
      Icons.bar_chart_outlined, Icons.settings_outlined, Icons.store_outlined,
      Icons.grain_outlined, Icons.local_shipping_outlined];
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
        if (manager) 6, 7, if (manager) 8, 9, if (owner) 10, 11, 12];
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
        10 => ShopifyPage(api: widget.api),
        11 => MaterialsPage(api: widget.api, canWrite: manager),
        _ => SuppliersPage(api: widget.api, canWrite: manager),
      };
      return Scaffold(
        key: scaffoldKey,
        appBar: AppBar(
          title: Text(titles[selected], style: const TextStyle(fontWeight: FontWeight.w700)),
        ),
        drawer: Drawer(child: SafeArea(child: Column(children: [
          Padding(padding: const EdgeInsets.fromLTRB(20, 24, 20, 16),
            child: Row(children: [
              const CircleAvatar(radius: 22, backgroundColor: Color(0xff173d34),
                child: Icon(Icons.spa_outlined, color: Colors.white)),
              const SizedBox(width: 12),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start,
                children: [Text(str(user['store'] is Map ? user['store']['name'] : 'Perfume ERP'),
                  maxLines: 1, overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
                  Text(str(user['email']), maxLines: 1, overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 12, color: Color(0xff718079)))])),
            ])),
          const Divider(height: 1),
          Expanded(child: ListView(padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            children: [for (final i in visible) Padding(
              padding: const EdgeInsets.only(bottom: 3),
              child: ListTile(leading: Icon(icons[i], size: 22),
                title: Text(titles[i]), selected: selected == i,
                selectedTileColor: const Color(0xffe5f0ea),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                onTap: () { Navigator.pop(context); switchTo(i); }),
            )])),
          const Divider(height: 1),
          Padding(padding: const EdgeInsets.all(12), child: ListTile(
            leading: const Icon(Icons.logout_rounded), title: const Text('تسجيل الخروج'),
            onTap: () async { try { await widget.api.logout(); }
              finally { widget.onLogout(); } },
          )),
        ]))),
        body: KeyedSubtree(key: ValueKey(selected), child: body),
        bottomNavigationBar: NavigationBar(
          height: 72,
          backgroundColor: Colors.white,
          indicatorColor: const Color(0xffe2efe8),
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

class _Dashboard extends StatefulWidget {
  const _Dashboard({required this.api, required this.user,
    required this.onSelect, required this.manager});
  final ErpApi api;
  final Json user;
  final ValueChanged<int> onSelect;
  final bool manager;
  @override
  State<_Dashboard> createState() => _DashboardState();
}

class _DashboardState extends State<_Dashboard> {
  String period = '7d';
  Json? cached;
  late Future<dynamic> report = load();
  Future<dynamic> load() => widget.api.get('/api/mobile/home?period=$period');
  void choose(String value) => setState(() { period = value; report = load(); });
  static const labels = {'today': 'اليوم', 'yesterday': 'أمس',
    '7d': 'آخر ٧ أيام', '30d': 'آخر ٣٠ يوم', 'month': 'هذا الشهر',
    'lastMonth': 'الشهر الماضي'};

  Widget metric(String label, dynamic value, IconData icon, String currency,
      {bool money = false}) => Card(child: Padding(
    padding: const EdgeInsets.all(16),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Icon(icon, color: const Color(0xff9a793f), size: 22),
      const SizedBox(height: 18),
      Text(money ? '${str(value)} $currency' : str(value), maxLines: 1,
        overflow: TextOverflow.ellipsis, textDirection: TextDirection.ltr,
        style: const TextStyle(fontSize: 21, fontWeight: FontWeight.w800,
          color: Color(0xff142720))),
      const SizedBox(height: 5),
      Text(label, style: const TextStyle(fontSize: 13, color: Color(0xff66766e))),
    ]),
  ));

  Widget shortcut(String title, IconData icon, VoidCallback onTap) =>
    InkWell(onTap: onTap, borderRadius: BorderRadius.circular(16),
      child: Container(padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 13),
        decoration: BoxDecoration(color: Colors.white,
          border: Border.all(color: const Color(0xffe5eae6)),
          borderRadius: BorderRadius.circular(16)),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 23, color: const Color(0xff173d34)),
          const SizedBox(height: 8),
          Text(title, maxLines: 1, overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
        ])));

  @override
  Widget build(BuildContext context) => FutureBuilder<dynamic>(
    future: report, builder: (context, snapshot) {
      if (snapshot.hasData) cached = json(snapshot.data['data']);
      if (cached == null) return snapshot.hasError
        ? Center(child: TextButton.icon(onPressed: () => setState(() => report = load()),
            icon: const Icon(Icons.refresh), label: const Text('تعذر التحميل · إعادة المحاولة')))
        : const PageSkeleton();
      final data = cached!;
      final sales = json(data['sales']);
      final cash = json(data['cash']);
      final returns = json(data['returns']);
      final expenses = json(data['expenses']);
      final currency = str(data['currency']);
      final name = str(widget.user['name']).trim();
      final quick = <(String, IconData, VoidCallback)>[
        if (widget.manager) ('طلب جديد', Icons.add_shopping_cart_outlined,
          () => openPage(context, NewOrderPage(api: widget.api))),
        if (widget.manager) ('منتج جديد', Icons.add_box_outlined,
          () => openPage(context, SimpleProductPage(api: widget.api))),
        if (widget.manager) ('إضافة مخزون', Icons.add_home_work_outlined,
          () => openPage(context, StockForm(api: widget.api))),
        if (widget.manager) ('إضافة مصروف', Icons.add_card_outlined,
          () => openPage(context, ExpenseForm(api: widget.api))),
        ('الطلبات', Icons.receipt_long_outlined, () => widget.onSelect(1)),
        ('المخزون', Icons.warehouse_outlined, () => widget.onSelect(2)),
        if (widget.manager) ('المرتجعات', Icons.assignment_return_outlined,
          () => widget.onSelect(5)),
      ];
      final metrics = <(String, dynamic, IconData, bool)>[
        ('صافي المبيعات', sales['net'], Icons.show_chart, true),
        ('الدفعات المستلمة', cash['received'], Icons.payments_outlined, true),
        ('الطلبات', sales['orders'], Icons.receipt_long_outlined, false),
        ('الوحدات المباعة', sales['units'], Icons.inventory_2_outlined, false),
        ('المصروفات', expenses['total'], Icons.account_balance_wallet_outlined, true),
        ('المرتجعات', returns['count'], Icons.assignment_return_outlined, false),
      ];
      return RefreshIndicator(onRefresh: () async {
        final next = load(); setState(() => report = next); await next;
      }, child: ListView(padding: const EdgeInsets.fromLTRB(16, 12, 16, 24), children: [
        if (snapshot.connectionState == ConnectionState.waiting)
          const LinearProgressIndicator(minHeight: 2),
        if (snapshot.hasError) Padding(padding: const EdgeInsets.only(bottom: 8),
          child: TextButton.icon(onPressed: () => setState(() => report = load()),
            icon: const Icon(Icons.refresh), label: const Text('تعذر تحديث الفترة · إعادة المحاولة'))),
        Text('أهلًا، ${name.isEmpty ? 'بك' : name.split(' ').first} 👋',
          style: const TextStyle(fontSize: 23, fontWeight: FontWeight.w800,
            color: Color(0xff142720))),
        const SizedBox(height: 4),
        Text(str((widget.user['store'] as Map?)?['name']),
          style: const TextStyle(color: Color(0xff718079))),
        const SizedBox(height: 20),
        Row(children: [
          for (final key in const ['today', 'yesterday', '7d'])
            Expanded(child: Padding(padding: const EdgeInsetsDirectional.only(end: 6),
              child: ChoiceChip(label: Text(labels[key]!, maxLines: 1,
                style: const TextStyle(fontSize: 12)),
                selected: period == key,
                onSelected: (_) => choose(key)))),
          PopupMenuButton<String>(tooltip: 'فترات أخرى',
            onSelected: choose,
            itemBuilder: (_) => [for (final key in const ['30d', 'month', 'lastMonth'])
              PopupMenuItem(value: key, child: Text(labels[key]!))],
            child: Container(padding: const EdgeInsets.all(11),
              decoration: BoxDecoration(
                color: !const ['today', 'yesterday', '7d'].contains(period)
                  ? const Color(0xffe2efe8) : Colors.white,
                border: Border.all(color: const Color(0xffdce4de)),
                borderRadius: BorderRadius.circular(12)),
              child: const Icon(Icons.tune, size: 20))),
        ]),
        if (!const ['today', 'yesterday', '7d'].contains(period))
          Padding(padding: const EdgeInsets.only(top: 8), child: Text(labels[period]!,
            style: const TextStyle(color: Color(0xff173d34), fontWeight: FontWeight.w600))),
        const SizedBox(height: 18),
        Container(padding: const EdgeInsets.all(22),
          decoration: BoxDecoration(color: const Color(0xff173d34),
            borderRadius: BorderRadius.circular(24)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Row(children: [Icon(Icons.trending_up, color: Color(0xffd8c59a)),
              SizedBox(width: 8), Text('إجمالي المبيعات',
                style: TextStyle(color: Color(0xffe0eae2), fontSize: 14))]),
            const SizedBox(height: 15),
            Text('${str(sales['gross'])} $currency', textDirection: TextDirection.ltr,
              style: const TextStyle(color: Colors.white, fontSize: 30,
                fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            Text(labels[period]!, style: const TextStyle(color: Color(0xffc9d9ce))),
          ])),
        const SizedBox(height: 22),
        const Text('ملخص النشاط', style: TextStyle(fontSize: 18,
          fontWeight: FontWeight.w800, color: Color(0xff142720))),
        const SizedBox(height: 12),
        LayoutBuilder(builder: (context, constraints) {
          final width = (constraints.maxWidth - 10) / 2;
          return Wrap(spacing: 10, runSpacing: 10, children: [
            for (final m in metrics) SizedBox(width: width,
              child: metric(m.$1, m.$2, m.$3, currency, money: m.$4)),
          ]);
        }),
        const SizedBox(height: 24),
        const Text('وصول سريع', style: TextStyle(fontSize: 18,
          fontWeight: FontWeight.w800, color: Color(0xff142720))),
        const SizedBox(height: 12),
        LayoutBuilder(builder: (context, constraints) {
          final width = (constraints.maxWidth - 16) / 3;
          return Wrap(spacing: 8, runSpacing: 8, children: [
            for (final q in quick) SizedBox(width: width,
              child: shortcut(q.$1, q.$2, q.$3)),
          ]);
        }),
      ]));
    });
}
