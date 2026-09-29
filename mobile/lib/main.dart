import 'package:flutter/material.dart';

import 'api.dart';
import 'account.dart';
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
        title: 'Auraic',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(
            seedColor: const Color(0xff191735),
            primary: const Color(0xff191735),
            surface: Colors.white,
          ),
          scaffoldBackgroundColor: appCanvas,
          appBarTheme: const AppBarTheme(
            backgroundColor: Color(0xff191735),
            foregroundColor: Colors.white,
            elevation: 0,
            scrolledUnderElevation: 0,
            centerTitle: false,
          ),
          cardTheme: CardThemeData(
            color: Colors.white,
            elevation: 1,
            shadowColor: const Color(0xffd7e0e7),
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
          navigationBarTheme: const NavigationBarThemeData(
            backgroundColor: Colors.white,
            indicatorColor: Color(0xffdceaf1)),
          useMaterial3: true,
        ),
        builder: (context, child) => Directionality(
          textDirection: TextDirection.rtl,
          child: child!,
        ),
        home: signedIn == null
            ? const AuraicSplash()
            : signedIn!
                ? ErpHome(api: api, onLogout: () => setState(() => signedIn = false))
                : LoginPage(api: api, onLogin: () => setState(() => signedIn = true)),
      );
}

class AuraicSplash extends StatelessWidget {
  const AuraicSplash({super.key});

  @override
  Widget build(BuildContext context) => const Scaffold(
    backgroundColor: Color(0xff191735),
    body: Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
      SizedBox(width: 300, height: 190, child: Image(
        image: AssetImage('assets/auraic-logo.jpg'), fit: BoxFit.cover)),
      SizedBox(height: 26),
      SizedBox(width: 76, child: LinearProgressIndicator(
        minHeight: 2, color: Color(0xffffe8a1),
        backgroundColor: Color(0x44ffe8a1))),
    ])),
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
    body: SafeArea(child: LayoutBuilder(builder: (context, viewport) =>
      SingleChildScrollView(child: ConstrainedBox(
        constraints: BoxConstraints(minHeight: viewport.maxHeight),
        child: Column(children: [
          Container(width: double.infinity, padding: const EdgeInsets.fromLTRB(28, 48, 28, 50),
            decoration: const BoxDecoration(color: Color(0xff191735),
              borderRadius: BorderRadius.vertical(bottom: Radius.circular(32))),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Center(child: SizedBox(width: 300, height: 170,
                child: Image(image: AssetImage('assets/auraic-logo.jpg'),
                  fit: BoxFit.cover))),
              const SizedBox(height: 10),
              const Center(child: Text('إدارة Auraic في مكان واحد',
                style: TextStyle(color: Color(0xffffe8a1), fontSize: 15))),
            ])),
          Padding(padding: const EdgeInsets.fromLTRB(20, 28, 20, 28),
            child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 420),
              child: Card(child: Padding(padding: const EdgeInsets.all(22),
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  const Text('أهلًا بعودتك', style: TextStyle(fontSize: 24,
                    fontWeight: FontWeight.w800, color: Color(0xff142720))),
                  const SizedBox(height: 4),
                  const Text('سجّل دخولك لمتابعة الطلبات والمخزون',
                    style: TextStyle(color: Color(0xff718079))),
                  const SizedBox(height: 24),
                  TextField(controller: email, keyboardType: TextInputType.emailAddress,
                    autofillHints: const [AutofillHints.email],
                    decoration: const InputDecoration(labelText: 'البريد الإلكتروني',
                      prefixIcon: Icon(Icons.mail_outline_rounded))),
                  const SizedBox(height: 14),
                  TextField(controller: password, obscureText: true,
                    autofillHints: const [AutofillHints.password],
                    onSubmitted: (_) { if (!busy) submit(); },
                    decoration: const InputDecoration(labelText: 'كلمة المرور',
                      prefixIcon: Icon(Icons.lock_outline_rounded))),
                  if (error != null) Padding(padding: const EdgeInsets.only(top: 16),
                    child: Text(error!, style: TextStyle(
                      color: Theme.of(context).colorScheme.error))),
                  const SizedBox(height: 24),
                  FilledButton(onPressed: busy ? null : submit,
                    child: Padding(padding: const EdgeInsets.symmetric(vertical: 7),
                      child: busy ? const SizedBox(height: 20, width: 20,
                        child: CircularProgressIndicator(strokeWidth: 2,
                          color: Colors.white))
                        : const Text('تسجيل الدخول', style: TextStyle(
                          fontSize: 16, fontWeight: FontWeight.w700)))),
                ]))))),
        ]),
      )),
    )),
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
  int pageEpoch = 0;
  final scaffoldKey = GlobalKey<ScaffoldState>();
  late Future<dynamic> account = widget.api.get('/api/mobile/me');

  void switchTo(int index) {
    if (selected != index) setState(() => selected = index);
  }
  void refreshAt(int index) => setState(() { selected = index; pageEpoch++; });

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
      if (!snapshot.hasData) return Scaffold(body: snapshot.hasError
        ? Column(mainAxisSize: MainAxisSize.min, children: [Text('${snapshot.error}'),
          TextButton(onPressed: () => setState(() => account = widget.api.get('/api/mobile/me')),
            child: const Text('إعادة المحاولة')),
          TextButton(onPressed: widget.onLogout, child: const Text('تسجيل الدخول مجددًا'))])
        : const PageSkeleton());
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
        9 => SettingsPage(api: widget.api, isOwner: owner,
          onAccount: () => openPage(context, AccountPage(api: widget.api,
            isOwner: owner, onPasswordChanged: widget.onLogout))),
        10 => ShopifyPage(api: widget.api),
        11 => MaterialsPage(api: widget.api, canWrite: manager),
        _ => SuppliersPage(api: widget.api, canWrite: manager),
      };
      return Scaffold(
        key: scaffoldKey,
        appBar: AppBar(
          title: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(selected == 0 ? 'Auraic' : titles[selected],
              maxLines: 1, overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w800)),
            if (selected == 0) const Text('لوحة التحكم',
              style: TextStyle(fontSize: 11, color: Color(0xffc8dce6))),
          ]),
          actions: [if (manager) IconButton(tooltip: 'التقارير',
            onPressed: () => switchTo(8),
            icon: const Icon(Icons.analytics_outlined))],
        ),
        drawer: Drawer(child: SafeArea(child: Column(children: [
          Padding(padding: const EdgeInsets.fromLTRB(20, 24, 20, 16),
            child: Row(children: [
              const CircleAvatar(radius: 22, backgroundColor: Color(0xff191735),
                child: Image(image: AssetImage('assets/auraic-icon.png'))),
              const SizedBox(width: 12),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start,
                children: [const Text('Auraic',
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
          ListTile(leading: const Icon(Icons.manage_accounts_outlined),
            title: const Text('الحساب والأمان'),
            onTap: () { Navigator.pop(context); openPage(context,
              AccountPage(api: widget.api, isOwner: owner, onPasswordChanged: widget.onLogout)); }),
          const Divider(height: 1),
          Padding(padding: const EdgeInsets.all(12), child: ListTile(
            leading: const Icon(Icons.logout_rounded), title: const Text('تسجيل الخروج'),
            onTap: () async { try { await widget.api.logout(); }
              finally { widget.onLogout(); } },
          )),
        ]))),
        body: KeyedSubtree(key: ValueKey('$selected-$pageEpoch'), child: body),
        bottomNavigationBar: NavigationBar(
          height: 68,
          backgroundColor: Colors.white,
          labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
          indicatorColor: const Color(0xffdceaf1),
          selectedIndex: selected == 0 ? 0 : selected == 1 ? 1
            : selected == 2 ? 3 : 4,
          onDestinationSelected: (index) {
            if (index == 2) {
              if (manager) {
                openPage<bool>(context, NewOrderPage(api: widget.api)).then((created) {
                  if (created == true && mounted) refreshAt(1);
                });
              } else {
                scaffoldKey.currentState?.openDrawer();
              }
              return;
            }
            if (index == 4) {
              scaffoldKey.currentState?.openDrawer();
              return;
            }
            switchTo(index == 3 ? 2 : index);
          },
          destinations: [
            const NavigationDestination(icon: Icon(Icons.home_outlined),
              selectedIcon: Icon(Icons.home_rounded), label: 'الرئيسية'),
            const NavigationDestination(icon: Icon(Icons.receipt_long_outlined),
              selectedIcon: Icon(Icons.receipt_long), label: 'الطلبات'),
            NavigationDestination(icon: Icon(manager ? Icons.add_circle_rounded
              : Icons.grid_view_rounded, size: 32, color: const Color(0xff123e57)),
              label: manager ? 'طلب جديد' : 'الأقسام'),
            const NavigationDestination(icon: Icon(Icons.warehouse_outlined),
              selectedIcon: Icon(Icons.warehouse), label: 'المخزون'),
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
  Future<void> addAndRefresh(Widget page) async {
    final saved = await openPage<bool>(context, page);
    if (saved == true && mounted) setState(() => report = load());
  }
  static const labels = {'today': 'اليوم', 'yesterday': 'أمس',
    '7d': 'آخر ٧ أيام', '30d': 'آخر ٣٠ يوم', 'month': 'هذا الشهر',
    'lastMonth': 'الشهر الماضي'};

  Widget metric(String label, dynamic value, IconData icon, String currency,
      {bool money = false}) => Card(child: Padding(
    padding: const EdgeInsets.all(14),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [Icon(icon, color: const Color(0xff638098), size: 18),
        const SizedBox(width: 6),
        Expanded(child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontSize: 12, color: Color(0xff657381))))]),
      const SizedBox(height: 12),
      Text(str(value), maxLines: 1,
        overflow: TextOverflow.ellipsis, textDirection: TextDirection.ltr,
        style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800,
          color: Color(0xff152b3c))),
      if (money) Text(currency, style: const TextStyle(
        fontSize: 11, color: Color(0xff788993))),
    ]),
  ));

  Widget shortcut(String title, IconData icon, VoidCallback onTap) =>
    InkWell(onTap: onTap, borderRadius: BorderRadius.circular(16),
      child: Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 17),
        decoration: BoxDecoration(color: Colors.white,
          border: Border.all(color: const Color(0xffe5eae6)),
          borderRadius: BorderRadius.circular(16)),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(width: 42, height: 42,
            decoration: BoxDecoration(color: const Color(0xffedf3f7),
              borderRadius: BorderRadius.circular(12)),
            child: Icon(icon, size: 21, color: const Color(0xff123e57))),
          const SizedBox(height: 10),
          Text(title, maxLines: 1, overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
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
        if (widget.manager) ('منتج جديد', Icons.add_box_outlined,
          () => addAndRefresh(SimpleProductPage(api: widget.api))),
        if (widget.manager) ('إضافة مخزون', Icons.add_home_work_outlined,
          () => addAndRefresh(StockForm(api: widget.api))),
        if (widget.manager) ('إضافة مصروف', Icons.add_card_outlined,
          () => addAndRefresh(ExpenseForm(api: widget.api))),
        ('الطلبات', Icons.receipt_long_outlined, () => widget.onSelect(1)),
        ('المخزون', Icons.warehouse_outlined, () => widget.onSelect(2)),
        if (widget.manager) ('المرتجعات', Icons.assignment_return_outlined,
          () => widget.onSelect(5)),
      ];
      final metrics = <(String, dynamic, IconData, bool)>[
        ('إجمالي المبيعات', sales['gross'], Icons.trending_up, true),
        ('صافي المبيعات', sales['net'], Icons.show_chart, true),
        ('الدفعات المستلمة', cash['received'], Icons.payments_outlined, true),
        ('الطلبات', sales['orders'], Icons.receipt_long_outlined, false),
        ('الوحدات المباعة', sales['units'], Icons.inventory_2_outlined, false),
        ('المرتجعات', returns['count'], Icons.assignment_return_outlined, false),
        ('المصروفات', expenses['total'], Icons.account_balance_wallet_outlined, true),
      ];
      return RefreshIndicator(onRefresh: () async {
        final next = load(); setState(() => report = next); await next;
      }, child: ListView(padding: const EdgeInsets.fromLTRB(16, 12, 16, 24), children: [
        if (snapshot.connectionState == ConnectionState.waiting)
          const LinearProgressIndicator(minHeight: 2),
        if (snapshot.hasError) Padding(padding: const EdgeInsets.only(bottom: 8),
          child: TextButton.icon(onPressed: () => setState(() => report = load()),
            icon: const Icon(Icons.refresh), label: const Text('تعذر تحديث الفترة · إعادة المحاولة'))),
        Text('صباح الخير، ${name.isEmpty ? 'أهلًا بك' : name.split(' ').first}',
          style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800,
            color: Color(0xff152b3c))),
        const SizedBox(height: 5),
        const Text('ملخص شغلك في الفترة المحددة',
          style: TextStyle(color: Color(0xff718079), fontSize: 12)),
        const SizedBox(height: 15),
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
        const SizedBox(height: 16),
        LayoutBuilder(builder: (context, constraints) {
          final width = (constraints.maxWidth - 10) / 2;
          return Wrap(spacing: 10, runSpacing: 10, children: [
            for (final m in metrics) SizedBox(width: width,
              child: metric(m.$1, m.$2, m.$3, currency, money: m.$4)),
          ]);
        }),
        const SizedBox(height: 22),
        const Text('عمليات سريعة', style: TextStyle(fontSize: 17,
          fontWeight: FontWeight.w800, color: Color(0xff152b3c))),
        const SizedBox(height: 10),
        if (widget.manager) Padding(padding: const EdgeInsets.only(bottom: 10),
          child: FilledButton.icon(
            onPressed: () => addAndRefresh(NewOrderPage(api: widget.api)),
            icon: const Icon(Icons.add_shopping_cart_outlined),
            label: const Padding(padding: EdgeInsets.symmetric(vertical: 9),
              child: Text('تسجيل طلب جديد', style: TextStyle(
                fontSize: 16, fontWeight: FontWeight.w700))))),
        LayoutBuilder(builder: (context, constraints) {
          final width = (constraints.maxWidth - 10) / 2;
          return Wrap(spacing: 10, runSpacing: 10, children: [
            for (final q in quick) SizedBox(width: width,
              child: shortcut(q.$1, q.$2, q.$3)),
          ]);
        }),
        const SizedBox(height: 20),
        if (widget.manager) TextButton.icon(onPressed: () => widget.onSelect(8),
          icon: const Icon(Icons.analytics_outlined),
          label: const Text('عرض التقارير التفصيلية')),
      ]));
    });
}
