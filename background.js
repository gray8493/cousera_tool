// --- Skipera Extension Background Script (ULTRON 10.0 - PRO BOUND & AUTH FIX) ---
// 🔄 VERSION 10.0: MODERN AUTH + PRO LICENSE ENFORCEMENT
// 🛡️ INCLUDES FIREWALL & ONE-KEY-ONE-USER BINDING

const BASE_URL = 'https://www.coursera.org/api/';
const GRAPHQL_GATEWAY = 'https://www.coursera.org/graphql-gateway';

let state = {
    config: {},
    userId: null,
    courseId: null,
    isRunning: false,
    isPro: false,
    boundUserId: null,
    expiryDate: null
};

// Open side panel on click
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);

// ---------------------------------------------------------------------------
// 🛡️ HALLUCINATION FIREWALL (STRICT ID ENFORCEMENT)
// ---------------------------------------------------------------------------
function enforceOptionId(val, options) {
    if (!options || options.length === 0) return "0";
    let sVal = String(val).replace(/['"]/g, '').trim();

    // 1. BLOCK PROBABILITIES
    if (/^(0\.\d+|1(\.0+)?)$/.test(sVal)) return options[0].id;

    // 2. EXACT MATCH
    const exact = options.find(o => o.id === sVal);
    if (exact) return exact.id;

    // 3. TEXT MATCH
    const lowerVal = sVal.toLowerCase();
    const textMatch = options.find(o => {
        const txt = (o.display?.cmlValue || "").replace(/<[^>]*>?/gm, '').toLowerCase();
        return txt.includes(lowerVal) || lowerVal.includes(txt);
    });
    if (textMatch) return textMatch.id;

    // 4. FALLBACK
    return options[0].id;
}

const QUESTION_MAP = {
    "Submission_MultipleChoiceQuestion": ["multipleChoiceResponse", "MULTIPLE_CHOICE"],
    "Submission_CheckboxQuestion": ["checkboxResponse", "CHECKBOX"],
    "Submission_PlainTextQuestion": ["plainTextResponse", "PLAIN_TEXT"],
    "Submission_RichTextQuestion": ["richTextResponse", "RICH_TEXT"],
    "Submission_RichTextQuestionSchema": ["richTextResponse", "RICH_TEXT"],
    "Submission_MultipleChoiceReflectQuestion": ["multipleChoiceResponse", "MULTIPLE_CHOICE"],
    "Submission_CheckboxReflectQuestion": ["checkboxResponse", "CHECKBOX"],
    "Submission_MathQuestion": ["mathResponse", "MATH"],
    "Submission_NumericQuestion": ["numericResponse", "NUMERIC"],
    "Submission_RegexQuestion": ["regexResponse", "REGEX"],
    "Submission_TextExactMatchQuestion": ["textExactMatchResponse", "TEXT_EXACT_MATCH"],
    "Submission_TextReflectQuestion": ["textReflectResponse", "TEXT_REFLECT"],
    "Submission_MultipleFillableBlanksQuestion": ["multipleFillableBlanksResponse", "MULTIPLE_FILLABLE_BLANKS"],
    "Submission_FileUploadQuestion": ["fileUploadResponse", "FILE_UPLOAD"]
};

const F = {
    CML: "fragment Cml on CmlContent { cmlValue dtdId }",
    RT: "fragment RT on Submission_RichText { ... on CmlContent { ...Cml } }",
    INSTR: "fragment Instr on Submission_Instructions { overview { ...RT } reviewCriteria { ... RT } }",
    OPT: "fragment Opt on Submission_MultipleChoiceOption { id display { ...RT } }",
    Q_RT: "fragment Q_RT on Submission_RichTextQuestion { id questionSchema { prompt { ...RT } } }",
    Q_PT: "fragment Q_PT on Submission_PlainTextQuestion { id questionSchema { prompt { ...RT } } }",
    Q_MC: "fragment Q_MC on Submission_MultipleChoiceQuestion { id questionSchema { prompt { ...RT } options { ...Opt } } }",
    Q_CB: "fragment Q_CB on Submission_CheckboxQuestion { id questionSchema { prompt { ...RT } options { ...Opt } } }",
    QB_TB: "fragment Q_TB on Submission_TextBlock { id body { ...RT } }",
    Q_FU: "fragment Q_FU on Submission_FileUploadQuestion { id questionSchema { prompt { ...RT } } }"
};
const ALL_FRAGMENTS = Object.values(F).join(" ");

function logToPanel(text) { chrome.runtime.sendMessage({ type: 'statusUpdate', text }); }
function cleanCML(cml) { return cml ? cml.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim() : ""; }
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchCourseraGraphQL(op, query, vars = {}) {
    const headers = {
        'X-Csrf3-Token': state.config.csrfToken,
        'Cookie': `CAUTH=${state.config.cauthToken}; CSRF3-Token=${state.config.csrfToken}`,
        'Content-Type': 'application/json',
        'x-requested-with': 'XMLHttpRequest'
    };
    const body = JSON.stringify({ operationName: op, query: query.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim(), variables: vars });

    try {
        let res = await fetch(`${GRAPHQL_GATEWAY}?opname=${op}`, { method: 'POST', headers, body });
        if (res.status === 401 || res.status === 403) {
            res = await fetch(`${BASE_URL}opencourse.v1/graphql?opname=${op}`, { method: 'POST', headers, body });
        }
        return await res.json();
    } catch (e) { return { error: e.message }; }
}

async function getUserId() {
    try {
        let res = await fetchCourseraGraphQL('UserV1', 'query UserV1 { UserV1 { me { id } } }');
        if (res.data?.UserV1?.me?.id) { state.userId = res.data.UserV1.me.id; return true; }
        res = await fetchCourseraGraphQL('AdminUserPermissionsV1', 'query AdminUserPermissionsV1 { AdminUserPermissionsV1 { me { id } } }');
        if (res.data?.AdminUserPermissionsV1?.me?.id) { state.userId = res.data.AdminUserPermissionsV1.me.id; return true; }
    } catch (e) { }
    return false;
}

async function startAutomation() {
    if (state.isRunning) return;
    state.isRunning = true;

    const storage = await chrome.storage.local.get(['geminiKey', 'geminiModel', 'cauthToken', 'csrfToken', 'isPro', 'boundUserId', 'expiryDate', 'licenseKey']);
    state.config = { ...state.config, ...storage };
    state.isPro = storage.isPro || false;
    state.boundUserId = storage.boundUserId;
    state.expiryDate = storage.expiryDate;

    logToPanel('🚀 Starting Automation [v10.0]...');

    try {
        if (await getUserId()) {
            if (state.isPro) {
                const now = Date.now();
                if (now > state.expiryDate) {
                    logToPanel('❌ License Expired (30 days finished).');
                    state.isPro = false;
                } else if (state.boundUserId && state.userId !== state.boundUserId) {
                    logToPanel(`❌ License Bound to ID: ${state.boundUserId}. Current ID: ${state.userId}.`);
                    state.isPro = false;
                } else {
                    const daysLeft = Math.ceil((state.expiryDate - now) / (1000 * 60 * 60 * 24));
                    logToPanel(`✅ PRO Active: ${daysLeft} days remaining.`);
                }
            } else {
                logToPanel('ℹ️ Running Free Version (Pro features locked).');
            }

            await getCourseMaterials();
            logToPanel('✅ Done.');
        } else throw new Error("Check Cookies / Login");
    } catch (e) { logToPanel(`❌ ${e.message}`); }
    state.isRunning = false;
}

async function getCourseMaterials() {
    let slug = state.config.slug || '';
    if (slug.includes('/')) slug = slug.split('/').filter(Boolean).pop();
    const url = `${BASE_URL}onDemandCourseMaterials.v2/?q=slug&slug=${slug}&includes=modules,lessons,passableLessonElements,items&fields=moduleIds,onDemandCourseMaterialModules.v1(name,lessonIds),onDemandCourseMaterialLessons.v1(name,elementIds),onDemandCourseMaterialItems.v2(name,contentSummary,timeCommitment,isLocked)&showLockedItems=true`;
    const res = await fetch(url, { headers: { 'Cookie': `CAUTH=${state.config.cauthToken}` } }).then(r => r.json());
    if (!res.elements?.length) throw new Error("Course not found.");
    state.courseId = res.elements[0].id;
    const linked = res.linked || {};
    const itemsMap = {};
    Object.keys(linked).forEach(k => { if (k.includes('Items')) linked[k].forEach(i => itemsMap[i.id] = i); });
    const modulesMap = Object.fromEntries((linked['onDemandCourseMaterialModules.v1'] || []).map(m => [m.id, m]));
    const lessonsMap = Object.fromEntries((linked['onDemandCourseMaterialLessons.v1'] || []).map(l => [l.id, l]));
    for (const mid of res.elements[0].moduleIds || []) {
        const mod = modulesMap[mid]; if (!mod) continue;
        logToPanel(`📦 ${mod.name}`);
        for (const lid of mod.lessonIds || []) {
            const les = lessonsMap[lid]; if (!les) continue;
            logToPanel(`  📂 ${les.name}`);
            for (const eid of les.elementIds || []) {
                const iid = eid.split('~').pop();
                const item = itemsMap[iid] || itemsMap[eid];
                if (item) await processItem(item, slug);
            }
        }
    }
}

async function processItem(item, slug) {
    const type = item.contentSummary?.typeName || 'unknown';
    const isQuiz = ["gradedQuiz", "practiceQuiz", "exam", "staffGraded", "ungradedAssignment", "practiceAssignment"].includes(type) || type.toLowerCase().includes('quiz');
    if (item.isLocked && !isQuiz) return;
    if (type === 'lecture' && state.config.skipVideo) {
        if (!state.isPro) return logToPanel(`      🔒 Skip Video (PRO only)`);
        await markCompleted(item.id);
    } else if (isQuiz && state.config.solveQuiz) {
        if (!state.isPro) return logToPanel(`      🔒 Solve Quiz (PRO only)`);
        await solveQuiz(item.id, item.name);
        await sleep(2000);
    }
}

async function solveQuiz(itemId, name) {
    try {
        const query = ALL_FRAGMENTS + " query QueryState($courseId: ID!, $itemId: ID!) { SubmissionState { queryState(courseId: $courseId, itemId: $itemId) { ... on Submission_SubmissionState { allowedAction integritySettings { attemptId } attempts { inProgressAttempt { id draft { id instructions { ...Instr } parts { __typename id partId:id ... on Submission_MultipleChoiceQuestion { questionSchema { prompt { ...RT } options { ...Opt } } } ... on Submission_CheckboxQuestion { questionSchema { prompt { ...RT } options { ...Opt } } } ... on Submission_FileUploadQuestion { questionSchema { prompt { ...RT } } } ... on Submission_TextBlock { body { ...RT } } } } } } } } } }";
        let res = await fetchCourseraGraphQL('QueryState', query, { courseId: state.courseId, itemId: itemId });
        let qState = res?.data?.SubmissionState?.queryState;
        if (qState?.allowedAction?.includes('START')) {
            await fetchCourseraGraphQL('Start', "mutation S($courseId: ID!, $itemId: ID!) { Submission_StartAttempt(input: {courseId: $courseId, itemId: $itemId}) { ... on Submission_StartAttemptSuccess { __typename } } }", { courseId: state.courseId, itemId: itemId });
            res = await fetchCourseraGraphQL('QueryState', query, { courseId: state.courseId, itemId: itemId });
            qState = res?.data?.SubmissionState?.queryState;
        }
        const draft = qState?.attempts?.inProgressAttempt?.draft || qState?.attempts?.inProgressAttempt;
        const attemptId = qState?.integritySettings?.attemptId || draft?.id;
        if (!draft || !attemptId) return;
        logToPanel(`      🧠 Solving: ${name}`);
        let context = "";
        if (draft.instructions?.overview) context += `OVERVIEW: ${cleanCML(draft.instructions.overview.cmlValue)}\n`;
        const toSolve = [];
        draft.parts.forEach(p => {
            if (p.__typename === 'Submission_TextBlock') context += `CONTEXT: ${cleanCML(p.body?.cmlValue)}\n`;
            else if (QUESTION_MAP[p.__typename]) toSolve.push(p);
        });
        let prompt = `Solve Coursera Quiz. JSON ONLY: [{"questionId": "...", "choiceId": "...", "text": "..."}]\nCONTEXT: ${context.substring(0, 3000)}\nQUESTIONS:\n`;
        toSolve.forEach((q, i) => {
            prompt += `${i + 1}. [${q.id}] ${cleanCML(q.questionSchema?.prompt?.cmlValue)}\n`;
            if (q.questionSchema?.options) q.questionSchema.options.forEach(o => prompt += `   - ID: ${o.id} | ${cleanCML(o.display?.cmlValue)}\n`);
        });
        const model = state.config.geminiModel || 'gemini-2.0-flash-exp';
        const gemRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${state.config.geminiKey}`, { method: 'POST', body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
        const gemJson = await gemRes.json();
        const aiJson = JSON.parse(gemJson.candidates[0].content.parts[0].text.match(/\[.*\]/s)[0]);
        const responses = aiJson.map(ans => {
            const q = toSolve.find(x => x.id === ans.questionId);
            if (!q) return null;
            const [key, type] = QUESTION_MAP[q.__typename];
            let val = null;
            if (type === 'MULTIPLE_CHOICE' || type === 'CHECKBOX') {
                const opts = q.questionSchema.options || [];
                const raw = Array.isArray(ans.choiceId) ? ans.choiceId : [ans.choiceId || ans.text];
                const clean = raw.map(r => enforceOptionId(r, opts));
                val = { chosen: type === 'CHECKBOX' ? clean : clean[0] };
            } else { val = { plainText: String(ans.text || ans.choiceId || "Done") }; }
            return { questionId: q.id, questionType: type, questionResponse: { [key]: val } };
        }).filter(Boolean);
        await fetchCourseraGraphQL('Save', "mutation Save($input: Submission_SaveResponsesInput!) { Submission_SaveResponses(input: $input) { ... on Submission_SaveResponsesSuccess { __typename } } }", {
            input: { courseId: state.courseId, itemId: itemId, attemptId: attemptId, questionResponses: responses }
        });
        await fetchCourseraGraphQL('Submit', "mutation Submit($input: Submission_SubmitLatestDraftInput!) { Submission_SubmitLatestDraft(input: $input) { ... on Submission_SubmitLatestDraftSuccess { __typename } } }", {
            input: { courseId: state.courseId, itemId: itemId, submissionId: attemptId }
        });
        logToPanel(`      ✅ Done.`);
    } catch (e) { logToPanel(`      ❌ Error: ${e.message}`); }
}

async function markCompleted(itemId) {
    await fetch(`${BASE_URL}onDemandCourseItemProgress.v1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Csrf3-Token': state.config.csrfToken, 'Cookie': `CAUTH=${state.config.cauthToken}; CSRF3-Token=${state.config.csrfToken}` },
        body: JSON.stringify({ courseId: state.courseId, itemId: itemId, id: `${state.userId}~${state.courseId}~${itemId}`, progressState: 'COMPLETED' })
    });
}

chrome.runtime.onMessage.addListener((m) => { if (m.action === 'startAutomation') { state.config = m.config; startAutomation(); } });
