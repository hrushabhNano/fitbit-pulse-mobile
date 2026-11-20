// Only declarations belong in the generated app manifest. All widget code/resources live in the local Expo module.
// This fork declares only the glow widgets (GlowWidgets.kt): one provider per kind and default size, so the launcher's
// picker lists each size. The classic Pulse widgets' code stays in the module but is no longer declared.
const { withAndroidManifest } = require("expo/config-plugins");
const BASE = "app.pulse.widgets";
/** [class name part, resource name, label kind] */
const GLOW = [
  ["Today", "today", "today"], ["TodayWide", "today_wide", "today"], ["TodayLarge", "today_large", "today"],
  ["Recovery", "recovery", "recovery"], ["RecoveryWide", "recovery_wide", "recovery"],
  ["Sleep", "sleep", "sleep"], ["SleepWide", "sleep_wide", "sleep"],
  ["Steps", "steps", "steps"], ["StepsWide", "steps_wide", "steps"],
  ["OverviewWide", "overview_wide", "overview"], ["OverviewLarge", "overview_large", "overview"],
];
/** The classic providers and their picker, removed from the manifest when an older config added them. */
const RETIRED = ["Small", "Medium", "Large"].map((s) => `${BASE}.Pulse${s}WidgetProvider`).concat(`${BASE}.WidgetConfigureActivity`);

function addWidgetDeclarations(manifest) {
  const app = manifest.manifest?.application?.[0];
  if (!app) throw new Error("[withWidgets] Android application is missing");
  app.receiver = (app.receiver ?? []).filter((r) => !RETIRED.includes(r.$["android:name"]));
  if (app.activity) app.activity = app.activity.filter((a) => !RETIRED.includes(a.$["android:name"]));
  for (const [cls, res, kind] of GLOW) {
    const name = `${BASE}.Glow${cls}WidgetProvider`;
    const entry = {
      $: { "android:name": name, "android:exported": "false", "android:label": `@string/glow_widget_${kind}` },
      "intent-filter": [{ action: [{ $: { "android:name": "android.appwidget.action.APPWIDGET_UPDATE" } }] }],
      "meta-data": [{ $: { "android:name": "android.appwidget.provider", "android:resource": `@xml/glow_widget_${res}_info` } }],
    };
    const index = app.receiver.findIndex((r) => r.$["android:name"] === name);
    if (index < 0) app.receiver.push(entry); else app.receiver[index] = entry;
  }
  return manifest;
}
module.exports = (config) => withAndroidManifest(config, (c) => { addWidgetDeclarations(c.modResults); return c; });
module.exports.addWidgetDeclarations = addWidgetDeclarations;
module.exports.GLOW_WIDGETS = GLOW;
