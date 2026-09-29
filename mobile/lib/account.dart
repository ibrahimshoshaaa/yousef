import 'package:flutter/material.dart';

import 'api.dart';
import 'ui.dart';

class AccountPage extends StatelessWidget {
  const AccountPage({required this.api, required this.isOwner, required this.onPasswordChanged, super.key});
  final ErpApi api;
  final bool isOwner;
  final VoidCallback onPasswordChanged;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('الحساب والأمان')),
    body: ListView(padding: const EdgeInsets.all(16), children: [
      const PageIntro(title: 'إدارة الحساب', subtitle: 'تحكم في كلمة المرور وصلاحيات الدخول', icon: Icons.admin_panel_settings_outlined),
      const SizedBox(height: 16),
      Card(child: ListTile(leading: const Icon(Icons.lock_outline),
        title: const Text('تغيير كلمة المرور'), subtitle: const Text('سيتم تسجيل خروجك من كل أجهزة الموبايل'),
        trailing: const Icon(Icons.chevron_left),
        onTap: () => openPage(context, ChangePasswordPage(api: api, onChanged: onPasswordChanged)))),
      if (isOwner) ...[
        const SizedBox(height: 12),
        Card(child: ListTile(leading: const Icon(Icons.group_add_outlined),
          title: const Text('إدارة المستخدمين'), subtitle: const Text('أضف أدمن آخر بنفس صلاحياتك'),
          trailing: const Icon(Icons.chevron_left),
          onTap: () => openPage(context, AccountUsersPage(api: api)))),
      ],
    ]),
  );
}

class ChangePasswordPage extends StatefulWidget {
  const ChangePasswordPage({required this.api, required this.onChanged, super.key});
  final ErpApi api;
  final VoidCallback onChanged;
  @override
  State<ChangePasswordPage> createState() => _ChangePasswordPageState();
}
class _ChangePasswordPageState extends State<ChangePasswordPage> {
  final current = TextEditingController();
  final next = TextEditingController();
  final repeat = TextEditingController();
  bool busy = false;
  @override
  void dispose() { current.dispose(); next.dispose(); repeat.dispose(); super.dispose(); }

  Future<void> save() async {
    if (next.text.length < 12 || next.text != repeat.text) {
      showMessage(context, 'كلمة المرور الجديدة لازم تكون ١٢ حرفًا على الأقل ومطابقة للتأكيد'); return;
    }
    setState(() => busy = true);
    try {
      await widget.api.post('/api/mobile/account/password', {
        'currentPassword': current.text, 'newPassword': next.text,
      });
      await widget.api.clearSession();
      if (mounted) widget.onChanged();
    } catch (e) { if (mounted) showMessage(context, '$e'); }
    finally { if (mounted) setState(() => busy = false); }
  }
  @override
  Widget build(BuildContext context) => FormScaffold(title: 'تغيير كلمة المرور', busy: busy,
    onSubmit: save, children: [
      const FormSection(title: 'تأكيد الهوية', subtitle: 'اكتب كلمة مرورك الحالية، ثم اختر كلمة جديدة.'),
      TextField(controller: current, obscureText: true,
        decoration: const InputDecoration(labelText: 'كلمة المرور الحالية', prefixIcon: Icon(Icons.lock_outline))),
      const SizedBox(height: 12),
      TextField(controller: next, obscureText: true,
        decoration: const InputDecoration(labelText: 'كلمة المرور الجديدة (١٢ حرفًا على الأقل)', prefixIcon: Icon(Icons.key_outlined))),
      const SizedBox(height: 12),
      TextField(controller: repeat, obscureText: true,
        decoration: const InputDecoration(labelText: 'تأكيد كلمة المرور الجديدة', prefixIcon: Icon(Icons.verified_user_outlined))),
      const SizedBox(height: 12),
      const Text('بعد الحفظ سجّل دخولك مجددًا على أجهزة الموبايل.', style: TextStyle(color: Color(0xff657381))),
    ]);
}

class AccountUsersPage extends StatefulWidget {
  const AccountUsersPage({required this.api, super.key});
  final ErpApi api;
  @override
  State<AccountUsersPage> createState() => _AccountUsersPageState();
}
class _AccountUsersPageState extends State<AccountUsersPage> {
  late Future<List<Json>> users = load();
  Future<List<Json>> load() async => rows(await widget.api.get('/api/mobile/account/users'));
  void reload() => setState(() => users = load());
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('المستخدمون')),
    body: FutureBuilder<List<Json>>(future: users, builder: (context, snapshot) {
      if (!snapshot.hasData) return snapshot.hasError
        ? Center(child: TextButton(onPressed: reload, child: Text('تعذر التحميل · ${snapshot.error}')))
        : const PageSkeleton();
      return RefreshIndicator(onRefresh: () async { reload(); await users; },
        child: ListView(padding: const EdgeInsets.all(16), children: [
          const PageIntro(title: 'فريق العمل', subtitle: 'كل أدمن له نفس صلاحيات مالك المتجر', icon: Icons.people_alt_outlined),
          const SizedBox(height: 16),
          FilledButton.icon(onPressed: () async {
            final created = await openPage<bool>(context, NewOwnerPage(api: widget.api));
            if (created == true) reload();
          }, icon: const Icon(Icons.person_add_alt_1), label: const Text('إضافة أدمن')),
          const SizedBox(height: 16),
          for (final user in snapshot.data!) Padding(padding: const EdgeInsets.only(bottom: 10),
            child: Card(child: ListTile(leading: CircleAvatar(child: Text(str(user['name']).isEmpty ? '؟' : str(user['name']).substring(0, 1))),
              title: Text(str(user['name']).isEmpty ? str(user['email']) : str(user['name'])),
              subtitle: Text(str(user['email']), maxLines: 1, overflow: TextOverflow.ellipsis),
              trailing: StatusPill(label: user['role'] == 'OWNER' ? 'أدمن' : 'مستخدم')))),
        ]));
    }),
  );
}

class NewOwnerPage extends StatefulWidget {
  const NewOwnerPage({required this.api, super.key});
  final ErpApi api;
  @override
  State<NewOwnerPage> createState() => _NewOwnerPageState();
}
class _NewOwnerPageState extends State<NewOwnerPage> {
  final name = TextEditingController();
  final email = TextEditingController();
  final password = TextEditingController();
  final currentPassword = TextEditingController();
  bool busy = false;
  @override
  void dispose() { name.dispose(); email.dispose(); password.dispose(); currentPassword.dispose(); super.dispose(); }
  Future<void> save() async {
    if (name.text.trim().length < 2 || !email.text.contains('@') || password.text.length < 12 || currentPassword.text.isEmpty) {
      showMessage(context, 'راجع الاسم والبريد وكلمة المرور (١٢ حرفًا على الأقل)'); return;
    }
    if (!await confirm(context, 'الحساب الجديد هيكون له كل صلاحيات الأدمن على المتجر. تأكيد الإضافة؟')) return;
    setState(() => busy = true);
    try {
      await perform(context, () => widget.api.post('/api/mobile/account/users', {
        'name': name.text.trim(), 'email': email.text.trim(), 'password': password.text,
        'currentPassword': currentPassword.text,
      }), success: 'تم إنشاء حساب الأدمن');
      if (mounted) Navigator.pop(context, true);
    } catch (_) { /* Error displayed by shared helper. */ }
    finally { if (mounted) setState(() => busy = false); }
  }
  @override
  Widget build(BuildContext context) => FormScaffold(title: 'أدمن جديد', busy: busy, onSubmit: save, children: [
    const FormSection(title: 'بيانات الحساب', subtitle: 'سيقدر يسجل دخول من التطبيق بنفس صلاحياتك.'),
    field('الاسم', name), field('البريد الإلكتروني', email, type: TextInputType.emailAddress),
    TextField(controller: password, obscureText: true,
      decoration: const InputDecoration(labelText: 'كلمة مرور الأدمن الجديد', prefixIcon: Icon(Icons.key_outlined))),
    const SizedBox(height: 16),
    const FormSection(title: 'تأكيد العملية', subtitle: 'اكتب كلمة مرورك أنت للسماح بإضافة أدمن آخر.'),
    TextField(controller: currentPassword, obscureText: true,
      decoration: const InputDecoration(labelText: 'كلمة مرور حسابك الحالية', prefixIcon: Icon(Icons.lock_outline))),
  ]);
}
