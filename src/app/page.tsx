import { SubjectSelection } from '@/components/subject-selection';

export default function HomePage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold text-primary">المرحلة الحالية: شات المدرّس</p>
        <h1 className="mt-2 text-2xl font-bold leading-relaxed text-foreground sm:text-3xl">
          تعلّم بأسلوب سقراطي، وبشرح يستند إلى مصادر موثوقة
        </h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          اختر مادة لبدء جلسة مع المدرّس الذكي. كل جلسة مرتبطة بمادة واحدة، ويعتمد
          الشرح حصريًا على المصادر الموثوقة للجلسة. تحتاج أولًا إلى إضافة مفتاح مزود
          من صفحة مفاتيح المزودات.
        </p>
      </div>
      
      <SubjectSelection />

      <section className="mt-8 rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-foreground">كيف تعمل هذه المرحلة؟</h2>
        <ul className="mt-3 grid gap-2 text-xs leading-6 text-muted-foreground sm:grid-cols-2">
          <li>• المفاتيح تُخزَّن محليًا في المتصفح.</li>
          <li>• إذا استنفد مفتاح حصته ينتقل النظام تلقائيًا إلى المفتاح النشط التالي.</li>
          <li>• المادة ثابتة داخل الجلسة، وتغييرها يتطلب جلسة جديدة.</li>
        </ul>
      </section>
    </div>
  );
}
