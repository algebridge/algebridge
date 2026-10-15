// Class controls and teacher-made accounts: what a teacher's blocks and
// assignments-only mode do to the path (lib/path.ts), how they merge across
// classes (lib/class-controls.ts), which menu items they hide
// (lib/school-mode.ts), and how a pasted class list is read
// (lib/student-accounts.ts).
//
//   npm run test:classroom

const P = await import("../path.ts");
const C = await import("../class-controls.ts");
const S = await import("../school-mode.ts");
const A = await import("../student-accounts.ts");

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) pass += 1;
  else {
    fail += 1;
    console.log(`FAIL ${name}${detail ? `: ${detail}` : ""}`);
  }
}

const empty = { skills: {} } as unknown as Parameters<typeof P.skillAccess>[0];
const first = P.PATH[0];
const second = P.PATH[1];
const done = { skills: { [first.skillId]: { level: "proficient", problemsAttempted: 5 } } } as unknown as typeof empty;

// The path as it was.
check("first skill open with no controls", P.skillAccess(empty, first.skillId).open);
check("second opens after the first", P.skillAccess(done, second.skillId).open);

// Blocks.
const blockedFirst = P.skillAccess(empty, first.skillId, { blocked: new Set([first.skillId]) });
check("a blocked skill is closed even when first", !blockedFirst.open && blockedFirst.byTeacher === true);
check("a blocked skill is closed even when finished", !P.skillAccess(done, first.skillId, { blocked: new Set([first.skillId]) }).open);
check("a blocked skill beats an assignment", !P.skillAccess(empty, first.skillId, { blocked: new Set([first.skillId]), assigned: new Set([first.skillId]) }).open);
check("staff are never blocked", P.skillAccess(empty, first.skillId, { staff: true, blocked: new Set([first.skillId]) }).open);

// Assignments only.
check("assigned-only closes the first skill", !P.skillAccess(empty, first.skillId, { assignedOnly: true }).open);
check("assigned-only opens an assigned skill far ahead", P.skillAccess(empty, P.PATH[10].skillId, { assignedOnly: true, assigned: new Set([P.PATH[10].skillId]) }).open);
check("assigned-only keeps finished work open", P.skillAccess(done, first.skillId, { assignedOnly: true }).open);
check("assigned-only closes the next skill on the path", !P.skillAccess(done, second.skillId, { assignedOnly: true }).open);

// Merging.
const unitId = first.unitId;
const merged = C.mergeControls([
  { ...C.emptyControls("a"), blockedUnits: [unitId], blockedFeatures: ["games"] },
  { ...C.emptyControls("b"), blockedSkills: ["x-skill"], blockedFeatures: ["house"], assignedOnly: true },
]);
check("a blocked unit blocks its skills", merged.blockedSkills.has(first.skillId));
check("skills from every class add up", merged.blockedSkills.has("x-skill"));
check("features from every class add up", merged.blockedFeatures.has("games") && merged.blockedFeatures.has("house"));
check("assigned-only in any class applies", merged.assignedOnly);
check("unknown features in a row are dropped", C.toControls({ class_id: "c", blocked_units: null, blocked_skills: null, blocked_features: ["games", "nope"], assigned_only: null, allow_leave: null }).blockedFeatures.join() === "games");

// Menus.
const nav = [
  { title: "Learn", items: [{ href: "/" }, { href: "/games" }] },
  { title: "Rewards", items: [{ href: "/house" }, { href: "/leaderboard" }] },
];
const hrefs = (n: typeof nav) => n.flatMap((s) => s.items.map((i) => i.href)).join(" ");
check("nothing blocked, nothing hidden", hrefs(S.navForSchool(nav, false, new Set())) === "/ /games /house /leaderboard");
check("teacher blocks hide their pages", hrefs(S.navForSchool(nav, false, new Set(["games", "house"]))) === "/ /leaderboard");
check("school mode keeps the house", hrefs(S.navForSchool(nav, true, new Set())) === "/ /house");
check("the house page belongs to house", S.classFeatureForPath("/house/street") === "house");

// Class lists.
const lines = A.parseStudentLines("Maria Lopez\n\nJordan Smith, JSmith@School.edu\nSam\nAna Ruiz\tana@x\nLee Park; lee@school.org");
check("blank lines are skipped", lines.length === 5, String(lines.length));
check("a name alone has no email", lines[0].error === null && lines[0].email === null && lines[0].name === "Maria Lopez");
check("an email is read and lowercased", lines[1].email === "jsmith@school.edu" && lines[1].name === "Jordan Smith");
check("a first name alone is refused", lines[2].error !== null);
check("a bad email is refused", lines[3].error !== null);
check("a semicolon works too", lines[4].error === null && lines[4].email === "lee@school.org");

const u = A.makeUsername("María José López", () => 0.5);
check("usernames are first.last plus 4 digits, no accents", u === "maria.lopez5500", u);
check("a username signs in at the student domain", A.signInEmail(" Maria.Lopez5500 ") === `maria.lopez5500@${A.USERNAME_DOMAIN}`);
check("an email signs in as itself", A.signInEmail("A@B.org") === "a@b.org");
const pw = A.makePassword();
check("passwords are two words and a number", /^[a-z]+-[a-z]+-\d\d$/.test(pw) && pw.length >= 8, pw);
check("the two words differ", A.makePassword(() => [3, 3, 5]).split("-")[0] !== A.makePassword(() => [3, 3, 5]).split("-")[1]);

console.log(`${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
