/*
 * AlgeBridge Hints: algebra problem detector.
 * Classic browser script (no imports). Attaches globalThis.AlgeBridgeDetect and,
 * when `module` exists, module.exports, so Node tests can require it.
 *
 * Pipeline: page text or math markup -> normalizeMath / texToText / mathmlToText
 * -> tokenize -> math spans -> features -> score, kind, level -> caps.
 * Precision matters more than recall: code, dates, prices, chemistry and plain
 * prose must stay quiet. The caps (capFor) hold back what real pages showed is
 * not a problem: formulas and identities, steps and answers of worked
 * solutions, encyclopedia prose, calculus. A small numeric evaluator checks
 * identities and finds the lines of a worked solution that restate the problem.
 * findProblems skips prose with no math seed, measures element sizes only where
 * hiding is likely, and remembers scores by text, so rescans stay cheap.
 * extension/test/realweb.mjs runs all of this against real public pages.
 */
(function (root) {
  "use strict";

  // ---------------------------------------------------------------------------
  // Character tables
  // ---------------------------------------------------------------------------
  var SUP = {
    "\u2070": "0", "\u00B9": "1", "\u00B2": "2", "\u00B3": "3", "\u2074": "4", "\u2075": "5",
    "\u2076": "6", "\u2077": "7", "\u2078": "8", "\u2079": "9", "\u207A": "+", "\u207B": "-",
    "\u207C": "=", "\u207D": "(", "\u207E": ")", "\u207F": "n", "\u2071": "i", "\u02E3": "x",
    "\u02B8": "y", "\u1D43": "a", "\u1D47": "b", "\u1D9C": "c", "\u1D48": "d", "\u1D49": "e",
    "\u1DA0": "f", "\u1D4D": "g", "\u02B0": "h", "\u02B2": "j", "\u1D4F": "k", "\u02E1": "l",
    "\u1D50": "m", "\u1D52": "o", "\u1D56": "p", "\u02B3": "r", "\u02E2": "s", "\u1D57": "t",
    "\u1D58": "u", "\u1D5B": "v", "\u02B7": "w", "\u1DBB": "z"
  };
  var SUB = {
    "\u2080": "0", "\u2081": "1", "\u2082": "2", "\u2083": "3", "\u2084": "4", "\u2085": "5",
    "\u2086": "6", "\u2087": "7", "\u2088": "8", "\u2089": "9", "\u208A": "+", "\u208B": "-",
    "\u208C": "=", "\u208D": "(", "\u208E": ")", "\u2090": "a", "\u2091": "e", "\u2092": "o",
    "\u2093": "x", "\u2099": "n", "\u1D62": "i", "\u2C7C": "j", "\u2096": "k", "\u2098": "m",
    "\u209C": "t"
  };
  var VULGAR = {
    "\u00BD": "1/2", "\u2153": "1/3", "\u2154": "2/3", "\u00BC": "1/4", "\u00BE": "3/4",
    "\u2155": "1/5", "\u2156": "2/5", "\u2157": "3/5", "\u2158": "4/5", "\u2159": "1/6",
    "\u215A": "5/6", "\u215B": "1/8", "\u215C": "3/8", "\u215D": "5/8", "\u215E": "7/8"
  };
  function charClass(map) { return new RegExp("[" + Object.keys(map).join("") + "]+", "g"); }
  var SUP_RE = charClass(SUP);
  var SUB_RE = charClass(SUB);
  var VULGAR_RE = new RegExp("[" + Object.keys(VULGAR).join("") + "]", "g");

  function wrapScript(a) {
    a = String(a == null ? "" : a).trim();
    if (!a) return "";
    if (/^-?[0-9]+(\.[0-9]+)?$/.test(a) || /^-?[A-Za-z\u03C0\u03B8]$/.test(a) || /^['\u2032]+$/.test(a)) return a;
    if (a.charAt(0) === "(" && a.charAt(a.length - 1) === ")" && balancedOuter(a)) return a;
    return "(" + a + ")";
  }
  function balancedOuter(a) {
    var d = 0;
    for (var i = 0; i < a.length; i++) {
      if (a[i] === "(") d++;
      else if (a[i] === ")") { d--; if (d === 0 && i < a.length - 1) return false; }
    }
    return d === 0;
  }

  function mapMathAlnum(ch) {
    var cp = ch.codePointAt(0);
    if (cp >= 0x1D400 && cp <= 0x1D6A3) {
      var idx = (cp - 0x1D400) % 52;
      return String.fromCharCode(idx < 26 ? 65 + idx : 97 + idx - 26);
    }
    if (cp >= 0x1D7CE && cp <= 0x1D7FF) return String((cp - 0x1D7CE) % 10);
    if (cp === 0x1D70B || cp === 0x1D745 || cp === 0x1D6D1 || cp === 0x1D77F || cp === 0x1D7B9) return "\u03C0";
    return ch;
  }

  // ---------------------------------------------------------------------------
  // normalizeMath
  // ---------------------------------------------------------------------------
  function normalizeMath(text) {
    var s = String(text == null ? "" : text);
    if (!s) return "";
    s = s.replace(/[\u200B-\u200D\u2060-\u2064\uFEFF\u00AD]/g, "");
    s = s.replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000\t\r\n\f\v]/g, " ");
    s = s.replace(/[\uD835][\uDC00-\uDFFF]/g, mapMathAlnum);
    s = s.replace(/\u210E/g, "h").replace(/\u212F/g, "e").replace(/\u2113/g, "l");
    s = s.replace(/[\u2212\u2010\u2011\u2012\u2013\u2014\u2015\uFE63\uFF0D\u2796]/g, "-");
    s = s.replace(/[\u00D7\u2715\u2A2F\u2219\u22C5\u00B7\u2217]/g, "*");
    s = s.replace(/[\u00F7\u2215\u2044]/g, "/");
    s = s.replace(/\uFF1D/g, "=").replace(/[\u2A7D\u2266]/g, "\u2264").replace(/[\u2A7E\u2267]/g, "\u2265");
    s = s.replace(/[\u2018\u2019\u02BC\u2032]/g, "'").replace(/[\u201C\u201D\u2033]/g, "\"");
    s = s.replace(/\u2026/g, "...");
    s = s.replace(/\u221A\s+/g, "\u221A");
    s = s.replace(VULGAR_RE, function (m, off, str) {
      var prev = off > 0 ? str.charAt(off - 1) : "";
      return (/[0-9]/.test(prev) ? " " : "") + VULGAR[m];
    });
    s = s.replace(SUP_RE, function (m) {
      var r = "";
      for (var i = 0; i < m.length; i++) r += SUP[m[i]];
      return "^" + wrapScript(r);
    });
    s = s.replace(SUB_RE, function (m) {
      var r = "";
      for (var i = 0; i < m.length; i++) r += SUB[m[i]];
      return "_" + wrapScript(r);
    });
    return s.replace(/ {2,}/g, " ").trim();
  }

  // Readable spacing for converted math: spaces around relations and binary
  // + and -, none just inside parentheses. Unary minus stays attached.
  function tidyMath(s) {
    s = String(s || "").replace(/<=/g, "\u2264").replace(/>=/g, "\u2265").replace(/!=/g, "\u2260");
    s = s.replace(/\s*([=<>\u2264\u2265\u2260\u2248])\s*/g, " $1 ");
    s = s.replace(/([0-9A-Za-z\u03C0\u03B8)\]|!'.])\s*([+\-\u00B1])\s*(?=[0-9A-Za-z\u03C0\u03B8(\[|\u221A\u03A3\\.])/g, "$1 $2 ");
    s = s.replace(/\(\s+/g, "(").replace(/\s+\)/g, ")").replace(/\[\s+/g, "[").replace(/\s+\]/g, "]");
    s = s.replace(/\s+,/g, ",").replace(/\s+;/g, ";").replace(/;(?=\S)/g, "; ");
    s = s.replace(/\^\s+/g, "^").replace(/_\s+/g, "_");
    return s.replace(/ {2,}/g, " ").trim();
  }

  // ---------------------------------------------------------------------------
  // texToText
  // ---------------------------------------------------------------------------
  var TEX_SYMBOLS = {
    cdot: "*", times: "*", ast: "*", div: "/", pm: "\u00B1", mp: "\u2213",
    le: "\u2264", leq: "\u2264", leqslant: "\u2264", ge: "\u2265", geq: "\u2265", geqslant: "\u2265",
    ne: "\u2260", neq: "\u2260", lt: "<", gt: ">", approx: "\u2248", equiv: "\u2261", sim: "~",
    infty: "\u221E", circ: "\u2218", degree: "\u00B0", cdots: "...", ldots: "...", dots: "...",
    dotsc: "...", dotsb: "...", vdots: "...", to: "\u2192", rightarrow: "\u2192",
    longrightarrow: "\u2192", Rightarrow: "\u21D2", implies: "\u21D2", iff: "\u21D4",
    leftrightarrow: "\u2194", "in": "\u2208", notin: "\u2209", cup: "\u222A", cap: "\u2229",
    sum: "\u03A3", prod: "\u03A0", "int": "\u222B", angle: "\u2220", perp: "\u22A5",
    parallel: "\u2225", prime: "'", lvert: "|", rvert: "|", vert: "|", mid: "|", lVert: "|",
    rVert: "|", Vert: "|", langle: "\u27E8", rangle: "\u27E9", lbrace: "{", rbrace: "}",
    lfloor: "\u230A", rfloor: "\u230B", lceil: "\u2308", rceil: "\u2309", emptyset: "\u2205",
    varnothing: "\u2205", therefore: "\u2234", partial: "\u2202", nabla: "\u2207", neg: "\u00AC",
    land: "\u2227", lor: "\u2228", forall: "\u2200", exists: "\u2203", subset: "\u2282",
    subseteq: "\u2286", ell: "l", hbar: "h", cdotp: "*", colon: ":", setminus: "\\",
    alpha: "\u03B1", beta: "\u03B2", gamma: "\u03B3", delta: "\u03B4", epsilon: "\u03B5",
    varepsilon: "\u03B5", zeta: "\u03B6", eta: "\u03B7", theta: "\u03B8", vartheta: "\u03B8",
    iota: "\u03B9", kappa: "\u03BA", lambda: "\u03BB", mu: "\u03BC", nu: "\u03BD", xi: "\u03BE",
    pi: "\u03C0", varpi: "\u03C0", rho: "\u03C1", sigma: "\u03C3", tau: "\u03C4", upsilon: "\u03C5",
    phi: "\u03C6", varphi: "\u03C6", chi: "\u03C7", psi: "\u03C8", omega: "\u03C9",
    Gamma: "\u0393", Delta: "\u0394", Theta: "\u0398", Lambda: "\u039B", Xi: "\u039E", Pi: "\u03A0",
    Sigma: "\u03A3", Phi: "\u03A6", Psi: "\u03A8", Omega: "\u03A9"
  };
  var TEX_FUNCS = {
    log: 1, ln: 1, lg: 1, exp: 1, sin: 1, cos: 1, tan: 1, sec: 1, csc: 1, cot: 1, arcsin: 1,
    arccos: 1, arctan: 1, sinh: 1, cosh: 1, tanh: 1, lim: 1, max: 1, min: 1, det: 1, gcd: 1, deg: 1
  };
  var TEX_DROP = {
    displaystyle: 1, textstyle: 1, scriptstyle: 1, scriptscriptstyle: 1, limits: 1, nolimits: 1,
    nonumber: 1, notag: 1, left: 0, right: 0, big: 0, Big: 0, bigg: 0, Bigg: 0, bigl: 0, bigr: 0,
    Bigl: 0, Bigr: 0, biggl: 0, biggr: 0, Biggl: 0, Biggr: 0, middle: 0, normalsize: 1, small: 1,
    large: 1, Large: 1, tiny: 1, footnotesize: 1, huge: 1, rm: 1, it: 1, bf: 1, cal: 1, sf: 1, tt: 1,
    mathstrut: 1, strut: 1, relax: 1, allowbreak: 1, newline: 1, hfill: 1
  };
  var TEX_TEXT = {
    text: 1, textrm: 1, textit: 1, textbf: 1, textsf: 1, texttt: 1, textnormal: 1, mbox: 1, hbox: 1,
    emph: 1, textup: 1
  };
  var TEX_WRAP = {
    mathrm: 1, mathit: 1, mathbf: 1, mathsf: 1, mathtt: 1, boldsymbol: 1, bm: 1, mathcal: 1,
    mathscr: 1, mathfrak: 1, operatorname: 1, overline: 1, underline: 1, vec: 1, hat: 1, bar: 1,
    tilde: 1, widehat: 1, widetilde: 1, overrightarrow: 1, overleftarrow: 1, dot: 1, ddot: 1,
    acute: 1, grave: 1, check: 1, breve: 1, mathring: 1, underbrace: 1, overbrace: 1, boxed: 1,
    cancel: 1, bcancel: 1, xcancel: 1, cancelto: 0, pmb: 1, displaylines: 1
  };
  var BLACKBOARD = { R: "\u211D", Z: "\u2124", N: "\u2115", Q: "\u211A", C: "\u2102" };

  function texCtx(s) { return { s: s, i: 0 }; }

  function texSkipSpace(p) { while (p.i < p.s.length && /\s/.test(p.s[p.i])) p.i++; }

  function texRawGroup(p) {
    texSkipSpace(p);
    if (p.s[p.i] !== "{") {
      if (p.i < p.s.length) { var c = p.s[p.i]; p.i++; return c; }
      return "";
    }
    var depth = 0, start = p.i + 1;
    for (; p.i < p.s.length; p.i++) {
      var ch = p.s[p.i];
      if (ch === "\\") { p.i++; continue; }
      if (ch === "{") depth++;
      else if (ch === "}") { depth--; if (depth === 0) { p.i++; return p.s.slice(start, p.i - 1); } }
    }
    return p.s.slice(start);
  }

  function texArg(p) {
    texSkipSpace(p);
    if (p.i >= p.s.length) return "";
    var c = p.s[p.i];
    if (c === "{") { p.i++; return texSeq(p, "}"); }
    if (c === "\\") return texCommand(p);
    p.i++;
    return c;
  }

  function texSeq(p, stop) {
    var out = "";
    while (p.i < p.s.length) {
      var c = p.s[p.i];
      if (stop && c === stop) { p.i++; return out; }
      if (c === "{") { p.i++; out += texSeq(p, "}"); continue; }
      if (c === "}") { p.i++; continue; }
      if (c === "\\") {
        if (p.s.substr(p.i, 6) === "\\right" && !/[A-Za-z]/.test(p.s.charAt(p.i + 6))) out = out.replace(/\s+$/, "");
        var isLeft = p.s.substr(p.i, 5) === "\\left" && !/[A-Za-z]/.test(p.s.charAt(p.i + 5));
        out += texCommand(p);
        if (isLeft) texSkipSpace(p);
        continue;
      }
      if (c === "^" || c === "_") {
        p.i++;
        out = out.replace(/\s+$/, "");
        var arg = texArg(p).trim();
        if (c === "^" && (arg === "\u2218" || arg === "\u00B0")) { out += "\u00B0"; continue; }
        if (c === "^" && /^'+$/.test(arg)) { out += arg; continue; }
        out += c + wrapScript(arg);
        // log_{10}10 must not read as log_1010, nor log_{b}x as log_bx
        if (/^[A-Za-z0-9]/.test(p.s.charAt(p.i)) || (c === "_" && p.s.charAt(p.i) === "\\")) out += " ";
        continue;
      }
      if (c === "&") { p.i++; out += " "; continue; }
      if (c === "~") { p.i++; out += " "; continue; }
      if (c === "$") { p.i++; continue; }
      if (c === "%") { while (p.i < p.s.length && p.s[p.i] !== "\n") p.i++; continue; }
      out += c;
      p.i++;
    }
    return out;
  }

  function texDelimiter(p) {
    texSkipSpace(p);
    if (p.i >= p.s.length) return "";
    var c = p.s[p.i];
    if (c === "\\") return texCommand(p);
    p.i++;
    if (c === ".") return "";
    return c;
  }

  function texSplitTop(body, sep) {
    var parts = [], depth = 0, envDepth = 0, last = 0;
    for (var i = 0; i < body.length; i++) {
      var ch = body[i];
      if (ch === "\\") {
        if (body.substr(i, 7) === "\\begin{") envDepth++;
        else if (body.substr(i, 5) === "\\end{") envDepth--;
        if (sep === "\\\\" && body[i + 1] === "\\" && depth === 0 && envDepth === 0) {
          parts.push(body.slice(last, i)); i++; last = i + 1; continue;
        }
        i++;
        continue;
      }
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
      else if (sep === "&" && ch === "&" && depth === 0 && envDepth === 0) { parts.push(body.slice(last, i)); last = i + 1; }
    }
    parts.push(body.slice(last));
    return parts;
  }

  function texEnvironment(p) {
    var name = texRawGroup(p).trim();
    var base = name.replace(/\*$/, "");
    if (base === "array" || base === "tabular") { texSkipSpace(p); if (p.s[p.i] === "{") texRawGroup(p); }
    var open = "\\begin{" + name + "}", close = "\\end{" + name + "}";
    var depth = 1, j = p.i, end = -1;
    while (j < p.s.length) {
      var nb = p.s.indexOf(open, j), ne = p.s.indexOf(close, j);
      if (ne < 0) break;
      if (nb >= 0 && nb < ne) { depth++; j = nb + open.length; continue; }
      depth--;
      if (depth === 0) { end = ne; break; }
      j = ne + close.length;
    }
    var body = end >= 0 ? p.s.slice(p.i, end) : p.s.slice(p.i);
    p.i = end >= 0 ? end + close.length : p.s.length;
    var rows = texSplitTop(body, "\\\\").map(function (r) {
      return texSplitTop(r, "&").map(function (cell) { return texSeq(texCtx(cell), null).trim(); });
    }).filter(function (cells) { return cells.join("").trim() !== ""; });
    if (/matrix$/.test(base)) {
      return "[" + rows.map(function (c) { return c.join(", "); }).join("; ") + "]";
    }
    var lines = rows.map(function (c) { return c.join(base === "cases" || base === "dcases" || base === "array" ? " " : "").trim(); });
    if (base === "cases" || base === "dcases" || base === "rcases") return "{ " + lines.join("; ") + " }";
    return lines.join("; ");
  }

  function texCommand(p) {
    p.i++; // backslash
    if (p.i >= p.s.length) return "";
    var c = p.s[p.i];
    var name;
    if (/[A-Za-z]/.test(c)) {
      var m = /^[A-Za-z]+/.exec(p.s.slice(p.i));
      name = m[0];
      p.i += name.length;
      if (p.s[p.i] === "*") p.i++;
    } else {
      p.i++;
      switch (c) {
        case ",": case ";": case ":": case " ": case ">": return " ";
        case "!": return "";
        case "\\": return "; ";
        case "{": return "{";
        case "}": return "}";
        case "|": return "|";
        case "(": case ")": case "[": case "]": return "";
        default: return c; // \% \$ \& \# \_
      }
    }
    if (name === "frac" || name === "dfrac" || name === "tfrac" || name === "cfrac") {
      var a = texArg(p), b = texArg(p);
      return "(" + a.trim() + ")/(" + b.trim() + ")";
    }
    if (name === "binom" || name === "dbinom" || name === "tbinom") {
      var n1 = texArg(p), k1 = texArg(p);
      return "C(" + n1.trim() + ", " + k1.trim() + ")";
    }
    if (name === "sqrt") {
      texSkipSpace(p);
      var idx = "";
      if (p.s[p.i] === "[") { p.i++; idx = texSeq(p, "]").trim(); }
      var rad = texArg(p).trim();
      return rootText(idx, rad);
    }
    if (name === "begin") return texEnvironment(p);
    if (name === "end") { texRawGroup(p); return ""; }
    if (Object.prototype.hasOwnProperty.call(TEX_DROP, name)) {
      return TEX_DROP[name] ? "" : texDelimiter(p);
    }
    if (TEX_TEXT[name]) return texRawGroup(p).replace(/\\([%$&#_ ])/g, "$1").replace(/\$/g, "");
    if (name === "mathbb" || name === "mathbbm") {
      var bb = texRawGroup(p).trim();
      return BLACKBOARD[bb] || bb;
    }
    if (TEX_WRAP[name]) return texArg(p);
    if (name === "cancelto") { texArg(p); return texArg(p); }
    if (name === "color" || name === "label" || name === "tag" || name === "hspace" || name === "vspace" ||
        name === "phantom" || name === "hphantom" || name === "vphantom" || name === "kern" || name === "mkern") {
      texRawGroup(p);
      return name === "hspace" ? " " : "";
    }
    if (name === "textcolor" || name === "colorbox") { texRawGroup(p); return texArg(p); }
    if (name === "quad" || name === "qquad" || name === "enspace" || name === "thinspace" || name === "space") return " ";
    if (name === "not") { var nx = texArg(p); return nx === "=" ? "\u2260" : nx; }
    if (TEX_FUNCS[name]) return " " + name + " ";
    if (Object.prototype.hasOwnProperty.call(TEX_SYMBOLS, name)) return TEX_SYMBOLS[name];
    return name;
  }

  // An n-th root in a form the server's parser reads: "3\u221A(x)" would mean 3 times
  // the square root, so index 3 and 4 use their own signs and any other index
  // becomes root(n, x).
  function rootText(idx, rad) {
    idx = String(idx == null ? "" : idx).replace(/\s+/g, "");
    if (/^\((.*)\)$/.test(idx) && balancedOuter(idx)) idx = idx.slice(1, -1);
    if (!idx || idx === "2") return "\u221A(" + rad + ")";
    if (idx === "3") return "\u221B(" + rad + ")";
    if (idx === "4") return "\u221C(" + rad + ")";
    return "root(" + idx + ", " + rad + ")";
  }

  function texToText(tex) {
    var s = String(tex == null ? "" : tex).trim();
    if (!s) return "";
    s = s.replace(/^\$\$?|\$\$?$/g, "").replace(/^\\[([]|\\[)\]]$/g, "");
    var out = texSeq(texCtx(s), null);
    return tidyMath(normalizeMath(out));
  }

  // ---------------------------------------------------------------------------
  // mathmlToText
  // ---------------------------------------------------------------------------
  function elementKids(node) {
    var out = [];
    for (var c = node.firstChild; c; c = c.nextSibling) if (c.nodeType === 1) out.push(c);
    return out;
  }
  function mmlName(node) {
    return String(node.localName || node.nodeName || "").toLowerCase().replace(/^.*:/, "");
  }
  function texAnnotation(el) {
    if (!el || !el.getElementsByTagName) return "";
    var anns = el.getElementsByTagName("annotation");
    for (var i = 0; i < anns.length; i++) {
      var enc = String(anns[i].getAttribute("encoding") || "").toLowerCase();
      if (enc.indexOf("tex") >= 0) return anns[i].textContent || "";
    }
    return "";
  }
  var MML_SPACED_OPS = /^[=<>\u2264\u2265\u2260\u2248+\-\u2212\u00B1\u2192]$/;
  function mmlRow(nodes) {
    var out = "";
    for (var i = 0; i < nodes.length; i++) {
      var part = mml(nodes[i]);
      if (out && part && /(?:^|[^A-Za-z])(log|ln|sin|cos|tan|exp)(_\w+|_\([^)]*\))?$/.test(out) && /^[A-Za-z0-9\u03C0]/.test(part)) out += " ";
      out += part;
    }
    return out;
  }
  function mml(node) {
    if (!node) return "";
    if (node.nodeType === 3) return node.nodeValue || "";
    if (node.nodeType !== 1) return "";
    var n = mmlName(node);
    var kids = elementKids(node);
    var t;
    switch (n) {
      case "annotation": case "annotation-xml": case "mphantom": case "none": case "mprescripts": return "";
      case "semantics": return kids.length ? mml(kids[0]) : "";
      case "mi": case "mn": case "ms": return node.textContent || "";
      case "mtext": t = node.textContent || ""; return t.trim() ? " " + t + " " : " ";
      case "mo":
        t = (node.textContent || "").trim();
        if (t === "\u2061") return " ";
        if (t === "\u2062" || t === "\u2064" || t === "") return "";
        if (t === "\u2063") return ", ";
        return MML_SPACED_OPS.test(t) ? " " + t + " " : t;
      case "mspace": return " ";
      case "mfrac": return "(" + mml(kids[0]).trim() + ")/(" + mml(kids[1]).trim() + ")";
      case "msup": return mml(kids[0]) + "^" + wrapScript(normalizeMath(mml(kids[1])));
      case "msub": return mml(kids[0]) + "_" + wrapScript(normalizeMath(mml(kids[1])));
      case "msubsup":
        return mml(kids[0]) + "_" + wrapScript(normalizeMath(mml(kids[1]))) + "^" + wrapScript(normalizeMath(mml(kids[2])));
      case "munder": case "mover": case "munderover":
        t = mml(kids[0]);
        if (/^\s*[\u03A3\u2211\u03A0\u220F]\s*$/.test(t)) {
          if (n === "mover") return t.trim() + "^" + wrapScript(normalizeMath(mml(kids[1])));
          var r = t.trim() + "_" + wrapScript(normalizeMath(mml(kids[1])));
          if (n === "munderover") r += "^" + wrapScript(normalizeMath(mml(kids[2])));
          return r;
        }
        return t;
      case "msqrt": return "\u221A(" + mmlRow(kids).trim() + ")";
      case "mroot": return rootText(normalizeMath(mml(kids[1])), mml(kids[0]).trim());
      case "mfenced":
        var open = node.getAttribute("open"), close = node.getAttribute("close"), seps = node.getAttribute("separators");
        open = open == null ? "(" : open; close = close == null ? ")" : close; seps = seps == null ? "," : seps.trim();
        return open + kids.map(function (k) { return mml(k).trim(); }).join((seps.charAt(0) || "") + " ") + close;
      case "mtable": return kids.map(mml).join("; ");
      case "mtr": case "mlabeledtr": return kids.map(mml).join(" ");
      default:
        var all = [];
        for (var c = node.firstChild; c; c = c.nextSibling) all.push(c);
        return mmlRow(all);
    }
  }
  function mathmlToText(el) {
    if (!el) return "";
    var tex = texAnnotation(el);
    if (tex) { var fromTex = texToText(tex); if (fromTex) return fromTex; }
    return tidyMath(normalizeMath(mml(el)));
  }

  // ---------------------------------------------------------------------------
  // hash: FNV-1a 32 bit, 8 hex chars
  // ---------------------------------------------------------------------------
  function hash(text) {
    var s = String(text == null ? "" : text);
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return ("0000000" + h.toString(16)).slice(-8);
  }

  // ---------------------------------------------------------------------------
  // Text clean-up before tokenizing: strip things that look numeric but are not
  // math (URLs, dates, times, phone numbers, versions, product codes, units).
  // ---------------------------------------------------------------------------
  var BRK = " \u00A4 ";
  var prepCache = new Map(), prepChars = 0;
  function prepText(text) {
    var key = String(text == null ? "" : text);
    var hit = prepCache.get(key);
    if (hit !== undefined) return hit;
    prepChars += key.length;
    if (prepChars > 1000000) { prepCache.clear(); prepChars = key.length; }
    var out = prepFresh(key);
    prepCache.set(key, out);
    return out;
  }
  function prepFresh(text) {
    var s = text.split(/\r?\n/).map(normalizeMath).filter(Boolean).join(" ; ");
    s = s.replace(/<=/g, "\u2264").replace(/>=/g, "\u2265").replace(/=</g, "\u2264").replace(/=>/g, "\u2265").replace(/!=/g, "\u2260");
    var dot = s.indexOf(".") >= 0, digit = /\d/.test(s);
    if (dot || s.indexOf("://") >= 0) s = s.replace(/\b(?:https?:\/\/|www\.)\S+/gi, BRK);
    // citations: ISBN 978-0-07-145227-4, doi:10.1016/0010-2180(92)90034-m, Bibcode, page ranges
    if (digit) s = s.replace(/\b(?:ISBN|ISSN|OCLC|PMID|PMC|LCCN|arXiv|doi|Bibcode|S2CID|JSTOR|hdl)(?:-1[03])?\s*[:#]?\s*\S+/gi, BRK);
    if (dot && digit) {
      s = s.replace(/\bpp?\.\s?\d+(?:\s?[-,]\s?\d+)*/g, BRK);
      s = s.replace(/\b(?:vol|no|ch|sec|art)\.\s?\d+/gi, BRK);
    }
    if (s.indexOf("@") >= 0) s = s.replace(/\b[\w.+-]+@[\w-]+\.[\w.]+\b/g, BRK);
    if (dot) s = s.replace(/\b[\w-]+\.(?:js|mjs|cjs|ts|tsx|jsx|py|java|cpp|cs|rb|go|rs|php|html?|css|scss|json|xml|ya?ml|png|jpe?g|gif|svg|webp|pdf|docx?|pptx?|xlsx?|csv|txt|md|zip|exe|dmg|apk|mp3|mp4|mov|wav)\b/gi, BRK);
    if (dot) {
      s = s.replace(/\b(?:[a-z]+\.)+(?:com|org|net|edu|gov|io|co|us|ai|app|dev)\b(?:\/\S*)?/gi, BRK);
      s = s.replace(/\b(?:e\.g|i\.e|etc|vs|approx|no|vol|fig|pg|pp)\./gi, BRK);
      s = s.replace(/\b[ap]\.\s?m\.?/gi, BRK);
    }
    if (s.indexOf("'") >= 0) s = s.replace(/([A-Za-z])'([A-Za-z])/g, "$1$2");
    if (/[#@]/.test(s)) s = s.replace(/[#@][\w-]+/g, BRK);
    if (!digit) return s.replace(/ {2,}/g, " ").trim();
    s = s.replace(/\b\d{4}-\d{1,2}-\d{1,2}\b/g, BRK);
    s = s.replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, BRK);
    s = s.replace(/\b\d{1,2}:\d{2}(?::\d{2})?(?:\s?[ap]m)?\b/gi, BRK);
    s = s.replace(/\b\d+:\d+\b/g, BRK);
    s = s.replace(/\bv?\d+\.\d+\.\d+(?:[.-]\w+)*\b/gi, BRK);
    s = s.replace(/\bv\d+(?:\.\d+)*\b/gi, BRK);
    s = s.replace(/(?:\+\d{1,2}\s?)?\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g, BRK);
    s = s.replace(/\b\d{3,5}\s?[x*]\s?\d{3,5}\b/gi, BRK);
    s = s.replace(/\b\d{3,4}[pi]\b/g, BRK);
    s = s.replace(/\b\d+(?:\.\d+)?[KMBT]\b(?!\s*[-+*\/^=(<>\u2264\u2265])/g, BRK);
    s = s.replace(/\b[A-Z]{1,4}-\d+[A-Z\d-]*\b/g, BRK);
    s = s.replace(/\b\d+[A-Za-z]+\d[A-Za-z\d]*\b/g, BRK);
    s = s.replace(/\b(?=[0-9a-f]*[a-f])(?=[0-9a-f]*\d)[0-9a-f]{7,40}\b/g, BRK);
    s = s.replace(/\b\d*(?=[A-Za-z\d]*[A-Z]\d)(?:[A-Z][a-z]?\d*)+\b/g, BRK);
    s = s.replace(/\b([A-Za-z]{1,3})(\d+)[A-Za-z\d]*\b/g, function (m, letters) {
      return /^(log|ln)$/i.test(letters) ? m : BRK;
    });
    s = s.replace(/(\d)\s*(?:km|m|ft|mi|cm|in)\/(?:s|h|hr|min)(?:\^2)?\b/g, "$1" + BRK);
    s = s.replace(/(\d)\s?(?:mph|kph|km|kg|mg|cm|mm|ml|mL|ft|yd|lbs?|oz|hrs?|mins?|secs?|ms|kW|kWh|Hz|kHz|MHz|GHz|Pa|kPa|mol|GB|MB|KB|TB|px|em|rem|pt|fps|dpi|ppi|bpm|cal|kcal)\b/g, "$1" + BRK);
    s = s.replace(/(?<!_\d*)(\d) (?:m|s|g|c|N|J|W|V|K|L)\b(?!\s*[-+*^=(<>\u2264\u2265]|\s*\/\s*\d)/g, "$1" + BRK);
    s = s.replace(/(\d)\s?(?:cups?|tsp|tbsp|qt|gal|pints?|quarts?)\b/gi, "$1" + BRK);
    s = s.replace(/(\d)\s?\u00B0\s?[CF]\b/g, "$1" + BRK);
    // areas and densities: 4,608.86/km^2, 3,001/sq mi, 250 sq ft, 12 km2
    s = s.replace(/(\d)\s?(?:\/\s?|per\s)?(?:sq\.?\s?(?:mi|km|ft|m|in|yd)\b\.?|(?:km|mi|ft|cm|mm|yd)\^?\(?[23]\)?(?![\d.])|square (?:miles?|kilometers?|feet|foot|meters?|inches|yards?)\b)/g, "$1" + BRK);
    s = s.replace(/(\d)\s?\/\s?m\^?\(?[23]\)?(?![\d.])/g, "$1" + BRK);
    // "the 2s", "how many 5s", "the 1990s": a plural number, not 2 times s
    s = s.replace(/\b(\d+)s\b(?!\s*[-+*\/^=<>\u2264\u2265(])/g, "$1" + BRK);
    return s.replace(/ {2,}/g, " ").trim();
  }

  // Strong signals that a text is source code, CSS, JSON, SQL or a spreadsheet formula.
  var CODE_PATTERNS = [
    [/;\s*(?:$|\n|\})/m, "statement-end"],
    [/==|!=|<>|=>|\+\+|\b\w+--|--\w|&&|\s\|\|\s|\*\*|::|\+=|-=|\*=|\/=|%=/, "operator"],
    [/\b(?:var|const)\s+[A-Za-z_$][\w$]*\s*=/, "declaration"],
    [/\blet\s+[A-Za-z_$][\w$]*\s*=[^;]*;/, "declaration"],
    [/\b(?:int|float|char|bool|boolean|String|void)\s+[A-Za-z_]\w*\s*(?:=|;|\()/, "typed-declaration"],
    [/\bfunction\s*[\w$]*\s*\([^)]*\)\s*\{/, "function"],
    [/\bdef\s+\w+\s*\(/, "python"],
    [/\bprint\s*\(|\bconsole\.\w+|\bSystem\.out|#include|\bprintf\s*\(|\bcout\s*<<|\belif\b|\blambda\s+\w*\s*:/, "code-call"],
    [/^\s*import\s+[\w.{*]+(?:\s+from\b|\s+as\b|\s*;|\s*$)/m, "import"],
    [/\bfrom\s+[\w.]+\s+import\b/, "import"],
    [/\breturn\s+[^.;\n]*;/, "return"],
    [/\b(?:public|private|protected)\s+(?:static|class|void|int|final)\b/, "java"],
    [/\bSELECT\b[\s\S]*\bFROM\b|\bINSERT\s+INTO\b|\bUPDATE\s+\w+\s+SET\b|\bDELETE\s+FROM\b|\bWHERE\s+\w+\s*(?:=|>|<|LIKE|IN)\b/, "sql"],
    [/(?:^|[{;]\s*)[a-z-]{3,}\s*:\s*[^;{}\n]+;/m, "css"],
    [/^\s*[.#]?[\w-]+(?:\s*[.#:][\w-]+)*\s*\{[^}]*:/m, "css"],
    [/"[\w\s.-]*"\s*:/, "json"],
    [/(?:^|[\s(])=\s*[A-Z]{2,}\(/, "spreadsheet"],
    [/\b[A-Z]{1,3}\$?\d+:\$?[A-Z]{1,3}\$?\d+\b/, "spreadsheet"],
    [/(?:^|\s)=\s*[A-Z]{1,3}\d+\s*[-+*\/]/, "spreadsheet"],
    [/\b[A-Za-z_]\w*\.[A-Za-z_]\w*\s*\(/, "member-call"],
    [/\b[A-Za-z_]\w*\[[\w+\-]+\]/, "index"],
    [/\b[a-z]{2,}[A-Z][a-z]+\w*\s*(?:=|\()/, "camel-case"],
    [/\b(?!log_)[a-z]{2,}_[a-z]{2,}\w*\s*(?:=|\()/, "snake-case"],
    [/(?:^|\s)\/\/\s|\/\*|\*\//, "comment"],
    [/(?:^|\s)--[A-Za-z][\w-]*(?:=|\b)|(?:^|\s)-[A-Za-z]=[A-Za-z]/, "cli-flag"],
    [/<\/?(?:div|span|p|a|br|img|ul|ol|li|table|tr|td|th|h[1-6]|script|style|html|head|body|input|button|form|section|header|footer|nav|strong|em|code|pre)\b[^<>]*>/i, "html"],
    [/\$\{|\{\{|\}\}/, "template"],
    [/(?:^|[\s;(])([A-Za-z_]\w*)\s*=\s*\1\s*(?:[-+*\/%]|\*\*)\s*[A-Za-z_]\w*\s*(?:;|$)/m, "assignment"],
    [/\b[A-Za-z_]\w*\s*%\s*[A-Za-z_](?!\w*\s+[a-z]{2,})\w*\b/, "modulo"],
    [/^\s*(?:if|for|while|switch)\s*\(.*\)\s*\{?\s*$/m, "control"],
    [/\b(?:if|for|while)\s*\([^)]*(?:==|<=|>=|<|>|!=|\+\+)[^)]*\)\s*\{/, "control"]
  ];
  function codeSignal(text) {
    for (var i = 0; i < CODE_PATTERNS.length; i++) if (CODE_PATTERNS[i][0].test(text)) return CODE_PATTERNS[i][1];
    return "";
  }

  // ---------------------------------------------------------------------------
  // Tokenizer
  // ---------------------------------------------------------------------------
  var FN_WORDS = { log: 1, ln: 1, sin: 1, cos: 1, tan: 1, sec: 1, csc: 1, cot: 1, sqrt: 1, exp: 1, abs: 1 };
  var FN_LETTERS = { f: 1, g: 1, h: 1, k: 1, p: 1, q: 1, r: 1, s: 1, P: 1, C: 1, A: 1, V: 1, N: 1, R: 1, F: 1, G: 1, H: 1, D: 1, T: 1, M: 1, B: 1, L: 1, W: 1 };
  var STOP = {};
  ("am an as at be by do go he hi if in is it me my no of oh ok on or so to up us we and are but can did " +
   "for had has her him his how its let may not now off old one our out own per put see she the too two use " +
   "was way who why yes yet you all any few get got new set ten six mph cm mm km kg mg ml ft yd mi lb lbs oz " +
   "hr hrs ms px em pt th st nd rd pm gb mb kb tb hz vs etc min max sec rem fps dpi ppi bpm cal mo yr yrs wk " +
   "pc tv id eh ah uh um lol omg btw fyi diy faq ceo usa uk eu ad bc ce ie eg ok nah yay hey wow").split(" ")
    .forEach(function (w) { STOP[w] = 1; });
  var TIMES_BLOCK = { "if": 1, when: 1, where: 1, "for": 1, and: 1, or: 1, is: 1, then: 1, so: 1, as: 1, equals: 1, than: 1, unless: 1, "while": 1, because: 1, but: 1, to: 1, into: 1, of: 1, from: 1, by: 1, with: 1 };
  var SPAN_OPS = "+-*/^_=<>\u2264\u2265\u2260\u2248\u00B1\u2213\u221A\u221B\u221C()[]{}|,!'\u2218\u00B0%\u221E\u03A3\u2211\u03A0\u220F\u2208\u211D\u2124\u2115\u211A\u222A\u2229";
  var REL_CHARS = "=<>\u2264\u2265\u2260\u2248";
  var MATH_OP_CTX = "+-*/^=<>\u2264\u2265\u2260\u00B1\u221A()|";
  var TOKEN_RE = /(\d+(?:\.\d+)?|\.\d+)|([A-Za-z\u03B1-\u03C9]+)|(\s+)|(\.\.\.|[\s\S])/g;

  function tokenize(s) {
    var toks = [], m, sp = false;
    TOKEN_RE.lastIndex = 0;
    while ((m = TOKEN_RE.exec(s))) {
      if (m[3]) { sp = true; continue; }
      toks.push({ k: m[1] ? "n" : m[2] ? "w" : "o", v: m[0], sp: sp, pos: m.index });
      sp = false;
    }
    for (var i = 0; i < toks.length; i++) toks[i].role = roleOf(toks, i);
    return toks;
  }
  function prevTok(toks, i) { return i > 0 ? toks[i - 1] : null; }
  function nextTok(toks, i) { return i + 1 < toks.length ? toks[i + 1] : null; }
  function isTimesX(toks, i) {
    var p = prevTok(toks, i), n = nextTok(toks, i);
    if (!p || !n) return false;
    if (!(p.k === "n" || p.v === ")")) return false;
    if (n.k === "n" || n.v === "$") return true;
    if (n.k === "w" && n.v.length > 1 && !FN_WORDS[n.v] && !TIMES_BLOCK[n.v.toLowerCase()]) return true;
    return false;
  }
  // "pre-defined", "and/or", "x-axis", "jsx/css": a hyphen or slash glued to a
  // word on the other side joins words, it is not subtraction or division.
  function gluedToWord(toks, i, minLen) {
    var t = toks[i], p = prevTok(toks, i), n = nextTok(toks, i);
    var pp = i > 1 ? toks[i - 2] : null, nn = i + 2 < toks.length ? toks[i + 2] : null;
    if (p && (p.v === "-" || p.v === "/") && !t.sp && !p.sp && pp && pp.k === "w" && (pp.v.length >= minLen || STOP[pp.v.toLowerCase()])) return true;
    if (n && (n.v === "-" || n.v === "/") && !n.sp && nn && !nn.sp && nn.k === "w" && (nn.v.length >= minLen || STOP[nn.v.toLowerCase()])) return true;
    return false;
  }
  var CLUSTER_CTX = "+-*/^=<>\u2264\u2265\u2260\u00B1\u221A()";
  function operandLike(t) { return !!t && (t.k === "n" || (t.k === "w" && t.v.length === 1) || t.v === ")" || t.v === "("); }
  function clusterOk(toks, i) {
    var t = toks[i], p = prevTok(toks, i), n = nextTok(toks, i);
    var pp = i > 1 ? toks[i - 2] : null, nn = i + 2 < toks.length ? toks[i + 2] : null;
    if (gluedToWord(toks, i, 2)) return false;
    // "32-bit", "3-day": a number glued to a word by a hyphen is an adjective
    if (p && p.v === "-" && !t.sp && !p.sp && pp && pp.k === "n") return false;
    if (p && !t.sp && (p.k === "n" || p.v === ")")) return true;
    if (n && !n.sp && (n.v === "^" || n.v === "_")) return true;
    // a binary operator or relation with a real operand on its far side
    if (p && p.k === "o" && CLUSTER_CTX.indexOf(p.v) >= 0 && p.v !== "(" && p.v !== ")" && operandLike(pp) && pp.v !== "(") return true;
    if (n && n.k === "o" && CLUSTER_CTX.indexOf(n.v) >= 0 && n.v !== "(" && n.v !== ")" && operandLike(nn) && nn.v !== ")") return true;
    return false;
  }
  function roleOf(toks, i) {
    var t = toks[i];
    if (t.k === "n") return "num";
    if (t.k === "o") {
      if (t.v === "...") return "op";
      if (t.v === ";") return "sep";
      if (SPAN_OPS.indexOf(t.v) >= 0) return "op";
      return "brk";
    }
    var v = t.v, lv = v.toLowerCase();
    if (FN_WORDS[v]) return "fn";
    if (v === "root" && toks[i + 1] && toks[i + 1].v === "(" && !toks[i + 1].sp) return "fn";
    if (v === "\u03C0") return "const";
    if (v.length === 1) {
      if ((v === "x" || v === "X") && isTimesX(toks, i)) return "times";
      var p = prevTok(toks, i), n = nextTok(toks, i);
      if (p && p.v === "." && !t.sp) return "brk";
      if (gluedToWord(toks, i, 3)) return "brk";
      if (n && n.v === "." && !n.sp && toks[i + 2] && toks[i + 2].k === "w" && !toks[i + 2].sp) return "brk";
      return "var";
    }
    if (lv === "and" || lv === "or") return "join";
    if (v.length <= 3 && /^[a-z\u03C0\u03B8]+$/.test(v) && !STOP[lv] && clusterOk(toks, i)) return "var";
    // "Ax + By = C": a capital coefficient letter glued to x, y or z
    if (/^[A-Z][xyz]$/.test(v)) {
      var pv = prevTok(toks, i), nv = nextTok(toks, i);
      if ((nv && nv.k === "o" && CLUSTER_CTX.indexOf(nv.v) >= 0 && nv.v !== "(") || (pv && pv.k === "o" && CLUSTER_CTX.indexOf(pv.v) >= 0 && pv.v !== ")")) return "var";
    }
    return "brk";
  }

  var OPERAND_END = ")]|!'\u00B0%\u221E";
  var OPERAND_START = "([|\u221A\u221B\u221C-+\u03A3\u2211{\u221E\u00B1";
  function isOperandEnd(t) { return !!t && (t.role === "num" || t.role === "var" || t.role === "const" || t.v === "..." || (t.k === "o" && OPERAND_END.indexOf(t.v) >= 0)); }
  function isOperandStart(t) { return !!t && (t.role === "num" || t.role === "var" || t.role === "const" || t.role === "fn" || (t.k === "o" && OPERAND_START.indexOf(t.v) >= 0)); }
  function isRel(t) { return !!t && t.k === "o" && REL_CHARS.indexOf(t.v) >= 0; }

  // Split the token stream into maximal math runs.
  function buildSpans(toks) {
    var spans = [], cur = null, gap = [];
    for (var i = 0; i < toks.length; i++) {
      var t = toks[i], r = t.role;
      if (r === "num" || r === "var" || r === "fn" || r === "op" || r === "times" || r === "const") {
        if (!cur) { cur = { toks: [], gap: gap }; spans.push(cur); gap = []; }
        cur.toks.push(t);
      } else {
        cur = null;
        gap.push(t);
      }
    }
    var out = [];
    for (var j = 0; j < spans.length; j++) {
      var tk = trimSpan(spans[j].toks);
      if (!tk.length) continue;
      // "A = 90-100, B = 80-89" or "x + y = 6, 2x - y = 3": split at top level commas
      // when the run holds two or more relations, so each piece is judged alone.
      var rels = 0, depth = 0, cuts = [];
      for (var q = 0; q < tk.length; q++) {
        var v = tk[q].v;
        if (v === "(" || v === "[" || v === "{") depth++;
        else if (v === ")" || v === "]" || v === "}") depth--;
        else if (isRel(tk[q])) rels++;
        else if (v === "," && depth === 0) cuts.push(q);
      }
      if (rels >= 2 && cuts.length) {
        var from = 0;
        cuts.push(tk.length);
        for (var c = 0; c < cuts.length; c++) {
          var piece = trimSpan(tk.slice(from, cuts[c]));
          if (piece.length) out.push({ toks: piece, gap: c === 0 ? spans[j].gap : [] });
          from = cuts[c] + 1;
        }
      } else out.push({ toks: tk, gap: spans[j].gap });
    }
    return out;
  }
  var LEAD_OK = "-([|\u221A\u221B\u221C\u03A3\u2211{\u00B1";
  var TRAIL_OK = ")]|!'\u00B0%";
  function trimSpan(tk) {
    var changed = true;
    while (changed && tk.length) {
      changed = false;
      var a = tk[0], z = tk[tk.length - 1];
      if (a.role === "op" && a.v !== "..." && LEAD_OK.indexOf(a.v) < 0) { tk = tk.slice(1); changed = true; continue; }
      if (a.role === "times") { tk = tk.slice(1); changed = true; continue; }
      if (z.role === "op" && z.v !== "..." && TRAIL_OK.indexOf(z.v) < 0) { tk = tk.slice(0, -1); changed = true; continue; }
      if (z.role === "times" || z.role === "fn") { tk = tk.slice(0, -1); changed = true; continue; }
      // drop an unmatched trailing ")" or leading "("
      var depth = 0, minDepth = 0;
      for (var i = 0; i < tk.length; i++) {
        if (tk[i].v === "(") depth++;
        else if (tk[i].v === ")") { depth--; if (depth < minDepth) minDepth = depth; }
      }
      if (minDepth < 0 && z.v === ")") { tk = tk.slice(0, -1); changed = true; continue; }
      if (depth > 0 && a.v === "(") { tk = tk.slice(1); changed = true; continue; }
    }
    return tk;
  }
  function spanText(tk) {
    var s = "";
    for (var i = 0; i < tk.length; i++) s += (i && tk[i].sp ? " " : "") + tk[i].v;
    return s;
  }

  // ---------------------------------------------------------------------------
  // Span analysis
  // ---------------------------------------------------------------------------
  function matchParens(tk) {
    var match = {}, stack = [];
    for (var i = 0; i < tk.length; i++) {
      var v = tk[i].v;
      if (v === "(" || v === "[" || v === "{") stack.push(i);
      else if ((v === ")" || v === "]" || v === "}") && stack.length) { var o = stack.pop(); match[o] = i; match[i] = o; }
    }
    return match;
  }
  function varsIn(tk, a, b) {
    var out = {};
    for (var i = a; i <= b && i < tk.length; i++) {
      if (tk[i].role === "var" && !tk[i].fnName && !tk[i].logBase) {
        var letters = tk[i].v.replace(/\u03C0/g, "");
        for (var j = 0; j < letters.length; j++) out[letters[j]] = 1;
      }
    }
    return out;
  }
  function hasBinaryPM(tk, a, b) {
    var depth = 0;
    for (var i = a; i <= b; i++) {
      var v = tk[i].v;
      if (v === "(" || v === "[") depth++;
      else if (v === ")" || v === "]") depth--;
      else if (depth === 0 && (v === "+" || v === "-" || v === "\u00B1") && i > a && isOperandEnd(tk[i - 1])) return true;
    }
    return false;
  }
  function onlyNumber(tk, a, b) {
    var j = a;
    if (j <= b && (tk[j].v === "-" || tk[j].v === "+")) j++;
    return j === b && tk[j].role === "num";
  }
  function countKeys(o) { var n = 0; for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) n++; return n; }

  // Degree of the polynomial part of a token list, plus the set of variables
  // that appear squared on their own (for circle and other conic equations).
  function polyDegree(tk, match) {
    var i = 0, n = tk.length, sq = {};
    function stop(t) { return !t || (t.k === "o" && /^[)\]}|=<>\u2264\u2265\u2260\u2248;]$/.test(t.v)); }
    function termSep(t) { return t && t.k === "o" && (t.v === "+" || t.v === "-" || t.v === "\u00B1" || t.v === ","); }
    function skipGroup() { var c = match[i]; i = c === undefined ? i + 1 : c + 1; }
    function sum() {
      var max = 0, guard = 0;
      while (i < n && guard++ < 400) {
        while (i < n && termSep(tk[i])) i++;
        if (i >= n || stop(tk[i])) break;
        var d = term();
        if (d > max) max = d;
      }
      return max;
    }
    function term() {
      var d = 0, guard = 0;
      while (i < n && !stop(tk[i]) && !termSep(tk[i]) && guard++ < 400) {
        var t = tk[i];
        if (t.v === "*" || t.role === "times") { i++; continue; }
        if (t.v === "/") { i++; factor(); continue; }
        d += factor();
      }
      return d;
    }
    function factor() {
      var t = tk[i], d = 0, single = null;
      if (!t) return 0;
      if (t.role === "num" || t.role === "const") { i++; }
      else if (t.role === "var") {
        i++;
        if (t.fnName) { if (tk[i] && tk[i].v === "(") skipGroup(); }
        else {
          var letters = t.v.replace(/\u03C0/g, "");
          if (letters === "e" && tk[i] && tk[i].v === "^") d = 0;
          else { d = letters.length; single = letters ? letters.charAt(letters.length - 1) : null; }
          if (tk[i] && tk[i].v === "_") { i++; if (tk[i] && tk[i].v === "(") skipGroup(); else i++; }
        }
      } else if (t.role === "fn") {
        i++;
        if (tk[i] && tk[i].v === "_") { i++; if (tk[i] && tk[i].v === "(") skipGroup(); else i++; }
        factor();
        d = 0;
      } else if (t.v === "(" || t.v === "[" || t.v === "{") {
        var close = match[i];
        var vs = close === undefined ? {} : varsIn(tk, i, close);
        i++;
        d = sum();
        if (close !== undefined) i = close + 1;
        if (countKeys(vs) === 1) for (var k in vs) single = k;
      } else if (t.v === "|") {
        i++; d = sum(); if (tk[i] && tk[i].v === "|") i++;
      } else if (t.v === "\u221A" || t.v === "\u221B" || t.v === "\u221C") {
        i++; factor(); d = 0;
      } else if (t.v === "-" || t.v === "+" || t.v === "\u00B1") {
        i++; return factor();
      } else { i++; return 0; }
      while (tk[i] && (tk[i].v === "^" || tk[i].v === "!" || tk[i].v === "'")) {
        if (tk[i].v !== "^") { i++; continue; }
        i++;
        var e = tk[i], val = null;
        if (e && e.role === "num") { val = parseFloat(e.v); i++; }
        else if (e && e.v === "-" && tk[i + 1] && tk[i + 1].role === "num") { val = -parseFloat(tk[i + 1].v); i += 2; }
        else if (e && e.v === "(") {
          var c = match[i];
          if (c !== undefined && onlyNumber(tk, i + 1, c - 1)) val = parseFloat(spanText(tk.slice(i + 1, c)).replace(/\s/g, ""));
          skipGroup();
        } else if (e) { i++; }
        if (val !== null && val >= 0 && Math.floor(val) === val) {
          if (val === 2 && single) sq[single] = 1;
          d = d * val;
        } else d = val !== null && val > 0 ? d * val : 0;
        single = null;
      }
      return d;
    }
    var maxD = 0, guard = 0;
    while (i < n && guard++ < 400) {
      var d = sum();
      if (d > maxD) maxD = d;
      if (i < n) i++;
    }
    return { deg: maxD, sq: sq };
  }

  // a point whose coordinates are numbers or fractions: (2, -1), (1/4, -2), ((1)/(4), -2)
  var POINT_NUM = "-?(?:\\d+(?:\\.\\d+)?|\\d+\\/\\d+|\\(\\d+\\)\\/\\(\\d+\\))";
  var POINT_RE = new RegExp("^\\(" + POINT_NUM + "," + POINT_NUM + "\\)$");

  function analyzeSpan(span) {
    var tk = span.toks, match = matchParens(tk);
    var F = {
      vars: {}, fnNames: {}, nums: 0, rels: [], ops: 0, pow: false, varPow: false, varExp: false, expE: false,
      rad: false, radVar: false, radNeg: false, absVar: false, ratVar: false, log: false, sigma: false,
      ellipsis: false, fnDefs: 0, fnEvals: 0, groupsPM: 0, groupProduct: false, groupGroup: false,
      points: 0, terms: 1, list: false, digits: 0, upperOnly: true,
      coefNums: 0, letterProd: false, greek: false, subVars: 0, varOcc: 0, trig: false
    };
    var i, t, p, nx;
    // tokens inside an exponent or a subscript: their numbers are not coefficients
    var inScript = [];
    for (i = 0; i < tk.length; i++) {
      if ((tk[i].v === "^" || tk[i].v === "_") && tk[i + 1]) {
        var se = i + 1;
        if (tk[i + 1].v === "(" && match[i + 1] !== undefined) se = match[i + 1];
        else if (tk[i + 1].v === "-" && tk[i + 2]) se = i + 2;
        for (var sj = i + 1; sj <= se; sj++) inScript[sj] = true;
        if (tk[i].v === "_" && tk[i - 1] && tk[i - 1].role === "fn" && tk[i + 1].role === "var" && !tk[i + 1].sp) tk[i + 1].logBase = true;
      }
    }
    // function notation first, so f in f(x) is a name, not a variable
    for (i = 0; i < tk.length; i++) {
      t = tk[i]; nx = tk[i + 1];
      if (t.role === "var" && t.v.length === 1 && FN_LETTERS[t.v] && nx && nx.v === "(" && !nx.sp && match[i + 1] !== undefined) {
        var c = match[i + 1];
        var inner = tk.slice(i + 2, c);
        var isDef = inner.length === 1 && inner[0].role === "var" && inner[0].v.length === 1;
        var isEval = onlyNumber(tk, i + 2, c - 1);
        var isComp = inner.length >= 1 && inner[0].role === "var" && inner[0].v.length === 1 && FN_LETTERS[inner[0].v] && inner[1] && inner[1].v === "(";
        if (isDef || isEval || isComp) {
          t.fnName = true;
          F.fnNames[t.v] = 1;
          if (isDef) F.fnDefs++;
          if (isEval) F.fnEvals++;
        }
      }
    }
    var bars = [];
    for (i = 0; i < tk.length; i++) {
      t = tk[i]; p = tk[i - 1]; nx = tk[i + 1];
      if (t.role === "num") {
        F.nums++; F.digits += t.v.replace(/\D/g, "").length;
        if (!inScript[i] && parseFloat(t.v) !== 0) F.coefNums++;
        if (p && !t.sp && p.v === ")") F.ops++;
        continue;
      }
      if (t.role === "var") {
        if (t.fnName) continue;
        if (t.logBase) continue;
        var letters = t.v.replace(/\u03C0/g, "");
        for (var j = 0; j < letters.length; j++) {
          F.vars[letters[j]] = 1;
          if (letters[j] !== letters[j].toUpperCase()) F.upperOnly = false;
        }
        if (t.v.length > 1) F.ops += t.v.length - 1;
        F.varOcc++;
        if (/[\u03B1-\u03B7\u03B9-\u03C9]/.test(t.v)) F.greek = true;
        if (nx && nx.v === "_" && !nx.sp) F.subVars++;
        if (t.v.length > 1 && /^(.)(?!\1+$)/.test(letters)) F.letterProd = true;
        if (p && p.role === "var" && !p.fnName && t.sp && !inScript[i]) F.letterProd = true;
        if (p && p.v === ")" && !t.sp && match[i - 1] !== undefined && countKeys(varsIn(tk, match[i - 1], i - 1))) F.letterProd = true;
        if (p && !t.sp && (p.role === "num" || p.v === ")" || p.role === "const")) F.ops++;
        if (p && p.role === "var" && !p.fnName && t.sp && !isRel(p)) F.ops++;
        continue;
      }
      if (t.role === "const") { if (p && !t.sp && (p.role === "num" || p.role === "var")) F.ops++; continue; }
      if (t.role === "fn") {
        F.ops++;
        if (t.v === "log" || t.v === "ln") F.log = true;
        if (/^(?:sin|cos|tan|sec|csc|cot)$/.test(t.v)) F.trig = true;
        if (t.v === "sqrt" || t.v === "root") {
          F.rad = true;
          if (nx && nx.v === "(" && match[i + 1] !== undefined) {
            if (countKeys(varsIn(tk, i + 1, match[i + 1]))) F.radVar = true;
            if (tk[i + 2] && tk[i + 2].v === "-" && tk[i + 3] && tk[i + 3].role === "num" && match[i + 1] === i + 4) F.radNeg = true;
          }
        }
        if (t.v === "abs") F.absVar = true;
        continue;
      }
      if (t.role === "times") { F.ops++; continue; }
      var v = t.v;
      if (isRel(t)) {
        if (isOperandEnd(p) && isOperandStart(nx) && !inScript[i]) F.rels.push(i);
        continue;
      }
      if (v === "^") {
        F.pow = true;
        if (isOperandEnd(p)) F.ops++;
        var baseVar = p && p.role === "var" && !p.fnName && p.v !== "e";
        var baseE = p && p.role === "var" && p.v === "e";
        var baseGroupVars = p && p.v === ")" && match[i - 1] !== undefined ? varsIn(tk, match[i - 1], i - 1) : null;
        var expVars = null;
        if (nx && nx.v === "(" && match[i + 1] !== undefined) expVars = varsIn(tk, i + 1, match[i + 1]);
        else if (nx && nx.role === "var") expVars = varsIn(tk, i + 1, i + 1);
        else if (nx && nx.v === "-" && tk[i + 2] && tk[i + 2].role === "var") expVars = varsIn(tk, i + 2, i + 2);
        var expHasVar = expVars && countKeys(expVars) > 0;
        if (!expHasVar && nx && nx.v === "(" && match[i + 1] !== undefined && /\//.test(spanText(tk.slice(i + 1, match[i + 1] + 1)))) {
          F.rad = true;
          if (baseVar || (baseGroupVars && countKeys(baseGroupVars))) F.radVar = true;
        }
        if (!expHasVar && (baseVar || (baseGroupVars && countKeys(baseGroupVars)))) F.varPow = true;
        if (expHasVar) {
          var baseNum = p && (p.role === "num" || (baseGroupVars && countKeys(baseGroupVars) === 0));
          var baseOther = false;
          if (baseGroupVars && countKeys(baseGroupVars)) {
            baseOther = true;
            for (var bv in baseGroupVars) if (expVars[bv]) baseOther = false;
          }
          if (baseNum || baseE || baseOther) { F.varExp = true; if (baseE) F.expE = true; }
        }
        continue;
      }
      if (v === "+" || v === "-" || v === "*" || v === "/" || v === "\u00B1") {
        if (isOperandEnd(p) && isOperandStart(nx)) F.ops++;
        if (v === "/" && nx) {
          if (nx.v === "(" && match[i + 1] !== undefined) { if (countKeys(varsIn(tk, i + 1, match[i + 1]))) F.ratVar = true; }
          else if (nx.role === "var" && !nx.fnName && nx.v !== "e") F.ratVar = true;
        }
        continue;
      }
      if (v === "\u221A" || v === "\u221B" || v === "\u221C") {
        F.rad = true; F.ops++;
        if (nx && nx.v === "(" && match[i + 1] !== undefined) {
          if (countKeys(varsIn(tk, i + 1, match[i + 1]))) F.radVar = true;
          if (tk[i + 2] && tk[i + 2].v === "-" && tk[i + 3] && tk[i + 3].role === "num" && match[i + 1] === i + 4) F.radNeg = true;
        } else if (nx && nx.role === "var") F.radVar = true;
        else if (nx && nx.v === "-" && tk[i + 2] && tk[i + 2].role === "num") F.radNeg = true;
        continue;
      }
      if (v === "|") { bars.push(i); continue; }
      if (v === "\u03A3" || v === "\u2211") { F.sigma = true; continue; }
      if (v === "...") { F.ellipsis = true; continue; }
      if (v === "(") {
        var cl = match[i];
        if (cl === undefined) continue;
        var gv = countKeys(varsIn(tk, i, cl)) > 0, gpm = hasBinaryPM(tk, i + 1, cl - 1);
        if (gv && gpm) F.groupsPM++;
        if (gv && p && !t.sp && p.role === "var" && !p.fnName) F.letterProd = true;
        if (p && !t.sp && (p.role === "num" || (p.role === "var" && !p.fnName) || p.v === ")" || p.role === "const")) {
          F.ops++;
          if (gv && gpm) F.groupProduct = true;
          if (p.v === ")" && match[i - 1] !== undefined && gv && gpm && hasBinaryPM(tk, match[i - 1] + 1, i - 2)) F.groupGroup = true;
        }
        if (cl === i + 4 && tk[i + 2].v === "," && (tk[i + 1].role === "num") && tk[i + 3].role === "num") F.points++;
        else if (cl > i && POINT_RE.test(spanText(tk.slice(i, cl + 1)).replace(/\s/g, ""))) F.points++;
      }
      if (v === ")" && nx && !nx.sp && (nx.role === "var" || nx.role === "num")) F.ops++;
    }
    if (bars.length >= 2 && countKeys(varsIn(tk, bars[0], bars[bars.length - 1]))) F.absVar = true;
    // numeric list like 3, 7, 11, 15, ...
    var listNums = 0, listOther = 0;
    for (i = 0; i < tk.length; i++) {
      if (tk[i].role === "num") listNums++;
      else if (tk[i].v !== "," && tk[i].v !== "-" && tk[i].v !== "+" && tk[i].v !== "..." && tk[i].v !== "/") listOther++;
    }
    var stx = spanText(tk);
    F.list = listNums >= 3 && listOther === 0 && (stx.indexOf(",") >= 0 || stx.indexOf("...") >= 0);
    // top level terms per side
    var depth = 0, terms = 1;
    for (i = 0; i < tk.length; i++) {
      var tv = tk[i].v;
      if (tv === "(" || tv === "[") depth++;
      else if (tv === ")" || tv === "]") depth--;
      else if (isRel(tk[i])) { if (terms > F.terms) F.terms = terms; terms = 1; }
      else if (depth === 0 && (tv === "+" || tv === "-") && i > 0 && isOperandEnd(tk[i - 1])) terms++;
    }
    if (terms > F.terms) F.terms = terms;
    var pd = polyDegree(tk, match);
    F.deg = pd.deg;
    F.sq = pd.sq;

    // relation sides
    var hasVar = countKeys(F.vars) > 0;
    // "x ≈ 2.3" reports a value; a relation to solve needs =, <, >, ≤, ≥ or ≠
    var valid = F.rels.some(function (ri) { return tk[ri].v !== "\u2248"; });
    var trivial = false, defLike = false, eqCount = 0, ineq = false, sides = null, lone = null;
    if (valid) {
      var cuts = [-1].concat(F.rels, [tk.length]);
      sides = [];
      for (i = 0; i + 1 < cuts.length; i++) {
        var sa = cuts[i] + 1, sb = cuts[i + 1] - 1;
        // brackets that open before or close after this side do not belong to it
        while (sa < sb && (tk[sa].v === "(" || tk[sa].v === "[") && !(match[sa] <= sb)) sa++;
        while (sb > sa && (tk[sb].v === ")" || tk[sb].v === "]") && !(match[sb] >= sa)) sb--;
        sides.push({ a: sa, b: sb });
      }
      lone = sides.map(function (sd) {
        if (sd.b === sd.a && tk[sd.a].role === "var" && tk[sd.a].v.length === 1) return "var";
        if (tk[sd.a] && tk[sd.a].role === "var" && tk[sd.a].v.length === 1 && tk[sd.a + 1] && tk[sd.a + 1].v === "_" &&
            (sd.b === sd.a + 2 || (tk[sd.a + 2] && tk[sd.a + 2].v === "(" && match[sd.a + 2] === sd.b))) return "var";
        if (tk[sd.a] && tk[sd.a].fnName && match[sd.a + 1] === sd.b) return "fn";
        return "";
      });
      var hasV = sides.map(function (sd) { return countKeys(varsIn(tk, sd.a, sd.b)) > 0; });
      for (i = 0; i < F.rels.length; i++) {
        if (tk[F.rels[i]].v === "=") eqCount++;
        else if (tk[F.rels[i]].v !== "\u2260" && tk[F.rels[i]].v !== "\u2248") ineq = true;
      }
      var nonTrivSide = false, varSides = 0, loneTok = false;
      for (i = 0; i < sides.length; i++) {
        if (!lone[i] && hasV[i]) nonTrivSide = true;
        if (hasV[i]) { varSides++; if (sides[i].a === sides[i].b && tk[sides[i].a].role === "var") loneTok = true; }
      }
      trivial = !nonTrivSide || (varSides === 1 && loneTok);
      defLike = F.rels.length === 1 && (lone[0] === "fn" || lone[0] === "var");
      if (sides.length === 2 && lone[0] === "fn" && !hasV[1]) trivial = true;
    }
    var score;
    if (valid && hasVar) score = trivial ? 0.15 : 0.75;
    else if (hasVar) {
      var strong = (F.varPow && (F.terms >= 2 || F.groupProduct)) || F.radVar || F.groupProduct || F.groupGroup ||
        (F.ratVar && F.ops >= 2) || (F.terms >= 3 && F.ops >= 3) || F.absVar && F.ops >= 2;
      score = strong ? 0.55 : F.ops > 0 ? 0.3 : 0.1;
    } else {
      score = (F.log || F.rad || F.pow || F.sigma) ? 0.25 : 0;
    }
    if (F.fnEvals && score < 0.3) score = 0.3;
    return {
      toks: tk, gap: span.gap, text: spanText(tk), F: F, score: score, hasVar: hasVar, valid: valid && hasVar,
      trivial: trivial, defLike: defLike, eqCount: eqCount, ineq: ineq, pos: tk[0].pos, sides: sides, lone: lone,
      match: match
    };
  }

  // ---------------------------------------------------------------------------
  // scoreText
  // ---------------------------------------------------------------------------
  var INSTR_VERB = /\b(solve|simplify|(?<!\b(?:common|greatest|a|the|prime|scale|growth|decay|conversion|each|one|its|integrating|same|this|that|second|first|other)\s)factor(?!\s+of\b)|evaluate|expand|foil|condense|rationalize|combine like terms|complete the square|completing the square|quadratic formula|(?<!\b(?:the|a|its|this|that|of|on|in|whose|same)\s)graph(?!\s+of\b)|rewrite|verify|classify|distribute|long division|synthetic division)\b/;
  var INSTR_PHRASE = /\b(find|write|determine|calculate|compute|identify|state|express|what is|what are|which|prove|show|showing|verify)\b(?:[^.?!;]|\.\d){0,80}?\b(value|values|slope|intercepts?|vertex|zeros?|roots?|solutions?|domain|range|inverse|equation|expression|product|sum|quotient|difference|nth|term|terms|axis|discriminant|x|y|n|t|f|g|h|answer|result|degree|asymptotes?|sequence|series|formula|function|rule|sides?)\b/;
  var INSTR_FORM = /\b(write|rewrite|put|convert|express|change|graph|give)\b(?:[^.?!;]|\.\d){0,60}\b(slope-intercept|point-slope|standard|vertex|factored|simplest|exponential|logarithmic|radical|intercept|scientific|sigma|interval) (form|notation)\b/;
  var INSTR_OP = /\b(multiply|divide|add|subtract)\b\s*[:.]?\s*(?:[\d(\u221A-]|(?!a\s)[a-z]\b|the (?:polynomials?|expressions?|binomials?|monomials?|trinomials?|fractions?|rational))/;
  var STORY = /\b(costs?|price|tickets?|pays?|paid|earns?|earned|saves?|saved|spends?|spent|buys?|bought|sells?|sold|charges?|fees?|rent|salary|wages?|dollars?|cents|miles|kilometers|hours?|minutes?|days?|weeks?|months?|years?|people|students|members|population|bacteria|interest|invests?|invested|loan|car|train|bus|plane|garden|rectangle|rectangular|fence|pool|length|width|area|perimeter|height|ball|rocket|age|older|younger|speed|travels?|distance|rate|profit|revenue|pizza|apples?|cups?|boxes|bags?|coins?|nickels|dimes|quarters|gallons?|liters?|feet|inches|meters|seconds|grows?|decays?|doubles?|half-life|deposit)\b|\$|\bhow (?:many|much|long|far|tall|high|old)\b/;
  var VERBAL_OP = /\b(?:product|quotient|sum of|difference of|difference between|divided by|multiplied by|times|more than|less than|increased by|decreased by|twice|half of|(?:one|two|three|four|five|seven|nine)-(?:half|halves|thirds?|fourths?|fifths?|sixths?|sevenths?|eighths?|ninths?|tenths?) of|percent of)\b/;
  var VERBAL_REL = /\b(?:is|equals|is equal to|was|gives|results in)\b/;
  var STORY_CUE = /\?|\bhow (?:many|much|long|far|old|tall|high)\b|\b(?:find|solve|determine|after how|what is|what are|what was|what will)\b|\bwrite (?:and solve )?(?:an?|the) (?:equation|expression|inequality|system)\b/;
  var FAMOUS = /^(?:E=mc\^2|F=ma|PV=nRT|V=IR|E=hf|p=mv|W=Fd|P=IV|F=mg|a\^2\+b\^2=c\^2)$/;
  var KW_FUNC = /\b(domain|range|inverse|composition|composite|piecewise)\b/;
  var KW_SEQ = /\b(sequence|sequences|series|nth term|n-th term|next term|next (?:two|three|four|five|\d+) terms|common difference|common ratio|arithmetic|geometric|recursive|recursion|explicit formula|explicit rule|recursive formula|first term)\b|\b[atu]_\(?(?:n|\d)\b/;
  var KW_SERIES = /\b(series|sum of the first|partial sum|sum of the \d+ terms|sum of the first \d+ terms)\b/;
  var KW_COMPLEX = /\b(imaginary|complex numbers?|complex solutions?|complex roots?|complex zeros?)\b/;
  var KW_QUAD = /\b(vertex|quadratic|complete the square|completing the square|axis of symmetry|discriminant|parabola)\b/;
  var KW_LINE = /\b(slope|y-intercept|x-intercept|intercepts?|line|point-slope|slope-intercept|parallel|perpendicular)\b/;
  var KW_FACTOR = /\bfactor(?:ing|ise|ize|ed)?\b|\bgcf\b|greatest common factor/;
  var KW_POLYDIV = /\b(long division|synthetic division)\b|\bdivide\b[^.;]*\bby\s*\(?\s*[a-z]\s*[-+]/;
  var KW_LITERAL = /\bsolve\b[^.;]*\bfor\s+[a-zA-Z]\b|\bin terms of\b/;
  var INVERSE_RE = /\binverse\b|\b[fghk]\s*\^\s*\(?\s*-\s*1\s*\)?\s*\(/;
  var COMPOSITE_RE = /\b(composition|composite)\b|\(\s*[fghk]\s*(?:\u2218|o|\*)\s*[fghk]\s*\)|\b[fghk]\s*\(\s*[fghk]\s*\(/;

  // "What is log_5(625)?", "Find 3x + 2 when x = 4": the ask is followed by the math itself
  var INSTR_ASK = /\b(?:what is|what's|what are|find|compute|calculate|evaluate|work out)\s+(?:the value of\s+)?(?=[-\d(\u221A\u221B\u221C|]|log|ln\b|sqrt|[a-z]\s*[-+*\/^=(_]|[a-z]\^)/;
  function hasInstruction(low) {
    return INSTR_VERB.test(low) || INSTR_PHRASE.test(low) || INSTR_FORM.test(low) || INSTR_OP.test(low) || INSTR_ASK.test(low);
  }


  // ---------------------------------------------------------------------------
  // A tiny numeric evaluator over span tokens. It answers two questions about
  // the math a page shows: is this relation an identity ((a + b)^2 = a^2 + 2ab
  // + b^2, 2y + 6 = 2(y + 3)), and are two equations the same equation written
  // two ways (a worked solution: 2x + 3(x - 3) = 6, then 5x - 15 = 0)? Anything
  // it cannot read makes it answer "unknown", never a guess.
  // ---------------------------------------------------------------------------
  var SAMPLES = [0.731, -1.618, 2.414, -0.377, 1.259, 2.903, -0.853, 1.917, 0.562];
  function compileSide(tk, a, b) {
    var i = a, absDepth = 0, names = {};
    function fail() { throw new Error("eval"); }
    function peek() { return i <= b ? tk[i] : null; }
    function opener(t) {
      return !!t && (t.role === "num" || t.role === "var" || t.role === "const" || t.role === "fn" || t.v === "(" || t.v === "[" ||
        t.v === "√" || t.v === "∛" || t.v === "∜" || (t.v === "|" && absDepth === 0));
    }
    function ref(name) { names[name] = 1; return function (e) { return e[name]; }; }
    // closures built in a helper, so each one keeps its own operands
    function bin(op, x, y) {
      if (op === "+") return function (e) { return x(e) + y(e); };
      if (op === "-") return function (e) { return x(e) - y(e); };
      if (op === "*") return function (e) { return x(e) * y(e); };
      if (op === "/") return function (e) { return x(e) / y(e); };
      return function (e) { return Math.pow(x(e), y(e)); };
    }
    function konst(v) { return function () { return v; }; }
    function expr() {
      var f = term();
      for (;;) {
        var t = peek();
        if (!t || (t.v !== "+" && t.v !== "-")) return f;
        i++;
        f = bin(t.v, f, term());
      }
    }
    function term() {
      var f = unary();
      for (;;) {
        var t = peek();
        if (t && (t.v === "*" || t.role === "times")) { i++; f = bin("*", f, unary()); }
        else if (t && t.v === "/") { i++; f = bin("/", f, unary()); }
        else if (opener(t)) f = bin("*", f, power());
        else return f;
      }
    }
    function unary() {
      var t = peek();
      if (t && t.v === "-") { i++; var g = unary(); return function (e) { return -g(e); }; }
      if (t && t.v === "+") { i++; return unary(); }
      return power();
    }
    function power() {
      var base = atom(), t = peek();
      if (t && t.v === "^") { i++; return bin("^", base, unary()); }
      return base;
    }
    function group(close) {
      var f = expr(), c = peek();
      if (!c || c.v !== close) fail();
      i++;
      return f;
    }
    function arg() {
      var t = peek();
      if (t && t.v === "(") { i++; return group(")"); }
      return power();
    }
    function root(n, g) {
      return function (e) { var x = g(e); return n % 2 && x < 0 ? -Math.pow(-x, 1 / n) : Math.pow(x, 1 / n); };
    }
    function atom() {
      var t = peek(), f, g;
      if (!t) fail();
      if (t.role === "num") { i++; return konst(parseFloat(t.v)); }
      if (t.role === "const") { i++; return konst(Math.PI); }
      if (t.role === "var") {
        if (t.fnName || /[^A-Za-z]/.test(t.v)) fail();
        i++;
        var nt = peek();
        if (nt && nt.v === "_" && !nt.sp && t.v.length === 1) {
          i++;
          var st = peek();
          if (!st || !(st.role === "num" || st.role === "var") || st.v.length > 2) fail();
          i++;
          return ref(t.v + "_" + st.v);
        }
        if (t.v.length === 1) return t.v === "e" ? konst(Math.E) : ref(t.v);
        var parts = t.v.split("").map(function (c) { return c === "e" ? konst(Math.E) : ref(c); });
        var pw = peek();
        if (pw && pw.v === "^") { i++; parts[parts.length - 1] = bin("^", parts[parts.length - 1], unary()); }
        return function (e) { var r = 1; for (var k = 0; k < parts.length; k++) r *= parts[k](e); return r; };
      }
      if (t.v === "(") { i++; return group(")"); }
      if (t.v === "[") { i++; return group("]"); }
      if (t.v === "|" && absDepth === 0) {
        i++; absDepth++; f = expr(); absDepth--;
        if (!peek() || peek().v !== "|") fail();
        i++;
        return function (e) { return Math.abs(f(e)); };
      }
      if (t.v === "√" || t.v === "∛" || t.v === "∜") {
        i++;
        return root(t.v === "√" ? 2 : t.v === "∛" ? 3 : 4, power());
      }
      if (t.role === "fn") {
        i++;
        var name = t.v;
        if (name === "log") {
          var baseF = konst(10), u = peek();
          if (u && u.v === "_") {
            i++;
            var bt = peek();
            if (!bt) fail();
            if (bt.v === "(") { i++; baseF = group(")"); }
            else if (bt.role === "num" || (bt.role === "var" && bt.v.length === 1)) { i++; baseF = bt.role === "num" ? konst(parseFloat(bt.v)) : bt.v === "e" ? konst(Math.E) : ref(bt.v); }
            else fail();
          }
          g = arg();
          return function (e) { return Math.log(g(e)) / Math.log(baseF(e)); };
        }
        if (name === "root") {
          if (!peek() || peek().v !== "(") fail();
          i++;
          var nF = expr();
          if (!peek() || peek().v !== ",") fail();
          i++;
          var xF = group(")");
          return function (e) { return Math.pow(xF(e), 1 / nF(e)); };
        }
        g = arg();
        var M = { ln: Math.log, sqrt: Math.sqrt, exp: Math.exp, abs: Math.abs, sin: Math.sin, cos: Math.cos, tan: Math.tan }[name];
        if (!M) fail();
        return function (e) { return M(g(e)); };
      }
      fail();
    }
    var fn = expr();
    if (i <= b) fail();
    return { f: fn, names: names };
  }
  function compileSafe(tk, a, b) {
    if (a > b) return null;
    try { return compileSide(tk, a, b); } catch (e) { return null; }
  }
  function envAt(names, k) {
    var e = {}, j = 0;
    for (var n in names) { e[n] = SAMPLES[(k + 2 * j) % SAMPLES.length] + 0.137 * j; j++; }
    return e;
  }
  function near(x, y) { return Math.abs(x - y) <= 1e-9 * (1 + Math.abs(x) + Math.abs(y)); }
  function mergeNames(list) {
    var out = {};
    list.forEach(function (c) { for (var n in c.names) out[n] = 1; });
    return out;
  }
  // true / false / null (unknown) for "every side of this = chain is the same expression"
  function isIdentity(span) {
    if (!span.valid || !span.sides || span.eqCount !== span.F.rels.length || span.sides.length < 2) return null;
    var cs = span.sides.map(function (sd) { return compileSafe(span.toks, sd.a, sd.b); });
    if (cs.some(function (c) { return !c; })) return null;
    var names = mergeNames(cs);
    if (!countKeys(names)) return null;
    var good = 0;
    for (var k = 0; k < SAMPLES.length; k++) {
      var e = envAt(names, k), vals = cs.map(function (c) { return c.f(e); });
      if (vals.some(function (v) { return !isFinite(v); })) continue;
      for (var q = 1; q < vals.length; q++) if (!near(vals[0], vals[q])) return false;
      good++;
    }
    return good >= 3 ? true : null;
  }
  // f = left - right for a span holding exactly one "=" relation
  function equationOf(span) {
    if (!span.valid || !span.sides || span.sides.length !== 2 || span.eqCount !== 1) return null;
    var l = compileSafe(span.toks, span.sides[0].a, span.sides[0].b), r = compileSafe(span.toks, span.sides[1].a, span.sides[1].b);
    if (!l || !r) return null;
    var names = mergeNames([l, r]);
    if (!countKeys(names)) return null;
    return { f: function (e) { return l.f(e) - r.f(e); }, names: names, key: Object.keys(names).sort().join(",") };
  }
  // the same equation written two ways: one is a nonzero constant times the other.
  // Two different one-variable linear equations with the same answer pass that
  // test too (5x - 2 = 13 and 7x + 1 = 22), so with strict set those must match
  // term for term (ratio 1 or -1) to count as one equation.
  function linearOneVar(p) {
    var names = Object.keys(p.names);
    if (names.length !== 1) return false;
    var xs = [0.731, 1.913, 2.657], ys = [];
    for (var k = 0; k < 3; k++) { var e = {}; e[names[0]] = xs[k]; ys.push(p.f(e)); }
    if (!ys.every(isFinite)) return false;
    var s1 = (ys[1] - ys[0]) / (xs[1] - xs[0]), s2 = (ys[2] - ys[0]) / (xs[2] - xs[0]);
    return Math.abs(s1 - s2) <= 1e-7 * (1 + Math.abs(s1));
  }
  function sameEquation(p, q, strict) {
    var r = equationRatio(p, q);
    if (r === null) return false;
    if (strict && linearOneVar(p)) return Math.abs(Math.abs(r) - 1) < 1e-9;
    return true;
  }
  function equationRatio(p, q) {
    if (!p || !q || p.key !== q.key) return null;
    var ratio = null, good = 0;
    for (var k = 0; k < SAMPLES.length; k++) {
      var e = envAt(p.names, k), a = p.f(e), b = q.f(e);
      if (!isFinite(a) || !isFinite(b)) continue;
      if (Math.abs(b) < 1e-9) { if (Math.abs(a) > 1e-7) return null; continue; }
      var r = a / b;
      if (ratio === null) ratio = r;
      else if (Math.abs(r - ratio) > 1e-7 * (1 + Math.abs(ratio))) return null;
      good++;
    }
    return good >= 3 && ratio !== null && Math.abs(ratio) > 1e-9 ? ratio : null;
  }
  // the one equation in a problem's expr, for comparing problems across blocks
  function equationOfText(text) {
    var spans = buildSpans(tokenize(prepText(text))).map(analyzeSpan).filter(function (s) { return s.valid && !s.trivial; });
    return spans.length === 1 ? equationOf(spans[0]) : null;
  }

  // A sentence that tells the student to do something, as opposed to text that
  // describes what "we can find" or how an equation "is solved".
  var IMPERATIVE = /(?:^|[.!?:;)\]]\s*|,\s*|\b(?:then|please|now)\s+|[\d&]\s+)(solve|simplify|factor|evaluate|expand|find|write|determine|calculate|compute|graph|rewrite|express|identify|state|show|explain|use|verify|check|prove|sketch|plot|convert|rationalize|combine|divide|multiply|add|subtract|complete|estimate|describe|compare|give|list|name|select|choose|circle|match|fill|translate|model|create|classify|decide|predict|apply|answer|condense|foil|distribute|perform|reduce|isolate|rearrange|tell)\b/;
  // a question about the problem, not "Why?" after an explanation
  var QUESTION = /(?:^|[.!?:;]\s)[^.!?]*\b(?:what|which|how|when|where|who|whose|find|solve|value|values|equal|equals|is|are|does|do|can|will|would|should)\b[^.!?]*\?/;
  var PROBLEM_Q = /\b(?:what|which|how (?:many|much|long|far|tall|old|high|fast)|find|solve|value|values)\b[^.!?]*\?/;
  var STEP_CUE = /\b(?:both sides|each side|start(?:ing)? with\s*:|we get|gives us|which gives|this gives|simplifies to|the answer is|the solution is|move [\w.^-]+ to (?:the )?(?:left|right))\b/;
  // tutorials that narrate their own solution: "So the first thing I have to do is factor"
  var NARRATION = /\b(?:i|we)\s+(?:can|can't|cannot|have|need|get|got|will|must|should|could|see|know|want|start|first|then|now|end up|am going|are going)\b/;
  var STEP_KEEP = /\b(?:solve|explain)\b/;
  var ANSWER_LINE = /^\s*(?:answer|answers|check|solution|solutions|result|proof|ans)\s*[:.=]/im;
  var CONDITION_WORDS = { when: 1, "if": 1, where: 1, "for": 1, given: 1, at: 1, is: 1, check: 1, whether: 1, verify: 1, that: 1, let: 1, assume: 1, suppose: 1, and: 1, with: 1, using: 1 };
  var CALCULUS = /∫|∂|∇|\blim\b|\(d\)\/\(d[a-z]\)|\bd[a-z]?\/d[a-z]\b|\bderivatives?\b|\bintegrals?\b|\b[a-z]'+\s*\(/;
  var EXAMPLE_LABEL = /^\s*(?:example|exercise|problem|question|practice|try it|q)\s*#?\d*\s*[:.)]/i;
  // with no variable there is nothing to solve: only these instructions make sense
  var NO_VAR_OK = /\b(?:simplify|evaluate|rationalize|expand|condense|compute|calculate|write|express|rewrite|convert|find|what is|multiply|divide|add|subtract)\b/;
  var SYSTEM_WORDS = /\bsystems?\b|\bsimultaneous/;

  // the text with each math span turned into a clause break, so "... Ax + By = C
  // solve this for y" reads as an instruction
  function skeleton(low, spans) {
    var out = "", at = 0;
    for (var i = 0; i < spans.length; i++) {
      var tk = spans[i].toks, a = tk[0].pos, z = tk[tk.length - 1].pos + tk[tk.length - 1].v.length;
      if (a < at) continue;
      out += low.slice(at, a) + " ; ";
      at = z;
    }
    return out + low.slice(at);
  }

  // a relation with no letters whose sides are equal and that does some arithmetic: 3^2 = 9, 2 * 4 = 8
  function trueArithmetic(span) {
    var F = span.F;
    if (span.hasVar || !F.rels.length || F.ops < 1 || F.rels.some(function (ri) { return span.toks[ri].v !== "="; })) return false;
    var tk = span.toks, cuts = [-1].concat(F.rels, [tk.length]), vals = [];
    for (var i = 0; i + 1 < cuts.length; i++) {
      var c = compileSafe(tk, cuts[i] + 1, cuts[i + 1] - 1);
      if (!c) return false;
      vals.push(c.f({}));
    }
    if (!vals.every(isFinite)) return false;
    for (var k = 1; k < vals.length; k++) if (!near(vals[0], vals[k])) return false;
    return true;
  }

  function inQuotes(low, span) {
    var a = span.toks[0].pos, before = low.slice(0, a), after = low.slice(span.toks[span.toks.length - 1].pos + 1);
    var q = (before.match(/"/g) || []).length;
    return q % 2 === 1 && after.indexOf('"') >= 0;
  }

  function capFor(raw, low, spans, bestSpan, ctx, reasons) {
    var cap = 1;
    function to(v, why) { if (v < cap) cap = v; reasons.push(why); }
    if (!bestSpan) return cap;
    var imperative = IMPERATIVE.test(low) || IMPERATIVE.test(skeleton(low, spans));
    var question = QUESTION.test(low);
    var literal = KW_LITERAL.test(low);
    var sig = spans.filter(function (s) { return s.score >= 0.25; });
    if (!sig.length) sig = [bestSpan];
    var vars = {}, coef = 0, prod = false, greek = false, sub = 0, occ = 0, trig = false, upper = true;
    sig.forEach(function (s) {
      for (var k in s.F.vars) vars[k] = 1;
      coef += s.F.coefNums; occ += s.F.varOcc; sub += s.F.subVars;
      if (s.F.letterProd) prod = true;
      if (s.F.greek) greek = true;
      if (s.F.trig) trig = true;
      if (!s.F.upperOnly) upper = false;
    });
    // e as the base of a power is Euler's number, not a letter of the formula
    var eBase = /(?:^|[^A-Za-z])e\s*\^/.test(bestSpan.text);
    if (eBase) delete vars.e;
    var nVars = countKeys(vars);
    var onlyI = nVars === 1 && vars.i === 1;
    var compact = bestSpan.text.replace(/\s+/g, "");
    var rels = spans.filter(function (s) { return s.valid; });
    var realRels = rels.filter(function (s) { return !s.trivial; });

    // Famous science formulas, letter-only formulas and identities (y = mx + b,
    // (a + b)(a - b) = a^2 - b^2) are not problems unless the page asks for a
    // literal equation to be solved or gives a short direct instruction.
    var shortOrder = imperative && ctx.proseWords <= 12;
    if (!ctx.instr && FAMOUS.test(compact)) to(0.3, "formula");
    else if (!ctx.instr && bestSpan.valid && countKeys(bestSpan.F.vars) >= 3 && bestSpan.F.digits <= 1) to(0.45, "formula");
    else if (!literal && !shortOrder && !ctx.story && ((nVars >= 3 && prod) || (nVars >= 2 && coef === 0))) to(0.45, "formula");
    else if (!literal && !ctx.story && !ctx.isSystem) {
      // one letter alone on a side, two or more other letters on the other: a formula solved for that letter
      realRels.forEach(function (s) {
        if (!s.lone || s.sides.length !== 2) return;
        for (var q = 0; q < 2; q++) {
          if (s.lone[q] !== "var") continue;
          var own = s.toks[s.sides[q].a].v, other = varsIn(s.toks, s.sides[1 - q].a, s.sides[1 - q].b);
          delete other[own];
          if (eBase) delete other.e;
          if (countKeys(other) >= 2) to(0.45, "formula");
        }
      });
    }
    if (!ctx.instr && upper && bestSpan.hasVar) to(0.45, "uppercase-only");

    // Long descriptive paragraphs (encyclopedias, lessons) mention math in
    // passing. A problem asks a question or gives an instruction.
    if (ctx.proseWords >= 16 && !question && !imperative) to(0.45, "exposition");
    // "the function f(x) = 1/x": a definition with nothing asked about it
    if (realRels.length && realRels.every(function (s) { return s.defLike && s.lone && s.lone[0] === "fn"; }) && !ctx.instr && !question) to(0.45, "definition");
    if (realRels.length && realRels.every(function (s) { return s.defLike; }) && !ctx.instr && !question && /\b(?:graph|curve|plot|line|parabola) of\b/.test(low)) to(0.45, "definition");

    // Steps of a worked solution: "Add 6 to both sides: 3x = 15", "Answer: x = 5",
    // "So the first thing I have to do is factor".
    if (STEP_CUE.test(low) && !STEP_KEEP.test(low)) to(0.45, "worked-step");
    if (NARRATION.test(low) && !PROBLEM_Q.test(low)) to(0.45, "narration");
    // "Quadratic equations such as x^2 + 3x - 10 = 0 can be solved": an example named in passing
    function exampleCue(s) {
      var g = (s.gap || []).filter(function (t) { return t.k === "w"; }).slice(-3).map(function (t) { return t.v.toLowerCase(); }).join(" ");
      return /\bfor example$|\bsuch as$|\blike$|\be\.?g$|\bfor example (?:if|when)$/.test(g) || (!realRels.length && /\bif you have$/.test(g));
    }
    if (realRels.length && !imperative && realRels.every(exampleCue)) to(0.45, "example-mention");
    if (!realRels.length && sig.every(exampleCue)) to(0.45, "example-mention");
    // "x + 1 = \u00B1\u221A3": the line after taking a square root
    if (realRels.some(function (s) { return s.toks.some(function (t) { return t.v === "\u00B1" || t.v === "\u2213"; }); })) to(0.45, "worked-step");
    if (ANSWER_LINE.test(raw)) to(0.3, "answer-line");
    // "Expand 3(x + 2):" with the result on the next line: the label of a worked step
    if (!realRels.length && /:\s*$/.test(raw) && raw.indexOf("\n") < 0 && raw.length <= 60) to(0.45, "step-label");
    if (rels.length >= 2 && !SYSTEM_WORDS.test(low)) {
      var last = rels[rels.length - 1];
      var lone = last.trivial && countKeys(last.F.vars) === 1;
      var gapCond = (last.gap || []).some(function (g) { return g.k === "w" && CONDITION_WORDS[g.v.toLowerCase()]; });
      if (lone && !gapCond) {
        var v = Object.keys(last.F.vars)[0];
        var earlier = rels.slice(0, -1).some(function (s) { return !s.trivial && s.F.vars[v]; });
        if (earlier) to(0.45, "worked-chain");
      }
      // each equation the one before it, rewritten
      var eqs = rels.map(equationOf), chain = eqs.length >= 2;
      for (var c = 1; c < eqs.length && chain; c++) if (!sameEquation(eqs[c - 1], eqs[c])) chain = false;
      if (chain) to(0.45, "worked-chain");
    }
    // "Calculate 3^2 = 9: x/2 = 9": a finished sum next to an equation is a worked step
    if (realRels.length && spans.some(trueArithmetic)) to(0.45, "worked-step");
    // "x - 3 = 0 or x - 4 = 0": the split after factoring, not a problem
    var eqRels = rels.filter(function (s) { return !s.ineq; });
    var joined = eqRels.every(function (s, k) {
      return k === 0 || (s.gap || []).filter(function (t) { return t.k === "w"; }).length <= 1;
    });
    if (eqRels.length >= 2 && realRels.length >= 1 && !ctx.isSystem && joined) {
      var one = {};
      eqRels.forEach(function (s) { for (var k in s.F.vars) one[k] = 1; });
      var joinedByOr = /\bor\b/.test(low);
      if (countKeys(one) === 1 && (!ctx.instr || joinedByOr)) to(0.45, "worked-step");
    }
    // an identity holds for every value: a fact being shown, not an equation to solve
    if (realRels.length && realRels.every(function (s) { return isIdentity(s) === true; }) && !/\b(?:solve|verify|prove|show that)\b/.test(low)) to(0.45, "identity");

    // "1 + 1/2 + ... + 1/n = \u03A3 1/k", "n! = 1 * 2 * ... * n": a series written out as a fact
    if (realRels.some(function (s) { return s.F.ellipsis || s.F.sigma; }) && !ctx.instr && !question) to(0.45, "series-formula");
    // "log \u221A(c/a) = (1.0576927 - 0.6192290)/2 = 0.2192318": arithmetic carried out on the page
    realRels.forEach(function (s) {
      if (!s.sides || s.sides.length < 3) return;
      var tail = s.sides.slice(-2).every(function (sd) { return !countKeys(varsIn(s.toks, sd.a, sd.b)); });
      if (tail) to(0.45, "computation");
    });
    // table values such as log a = 0.6192290
    if (/\d\.\d{6,}/.test(bestSpan.text) && !ctx.instr) to(0.45, "table-values");

    // "to 'solve' the equation for "x + 5 = 0" by dividing": math in quotes is mentioned, not set
    if (realRels.length && realRels.every(function (s) { return inQuotes(low, s); })) to(0.45, "quoted");

    // Outside Algebra 1 and 2: calculus always, trigonometry unless asked.
    if (CALCULUS.test(low)) to(0.4, "calculus");
    if (trig && !ctx.instr) to(0.45, "trig");
    if (greek) to(0.45, "greek");
    if (sub >= 2 && sub * 2 >= occ && !ctx.seqWords) to(0.45, "subscripts");

    // Arithmetic with no unknown: only some instructions make it an algebra task.
    if ((nVars === 0 || onlyI) && !ctx.seqHit && !ctx.linePoints && !bestSpan.F.fnEvals && !NO_VAR_OK.test(low)) to(0.45, "no-variable");

    // A bare expression with no instruction is an example in the text, not a task.
    if (!realRels.length && !ctx.instr && !ctx.isSystem && !ctx.linePoints && !ctx.seqHit && !ctx.story && !question &&
        !EXAMPLE_LABEL.test(raw) && !bestSpan.F.fnEvals) to(0.45, "bare-expression");
    return cap;
  }

  function emptyResult() {
    return { isAlgebra: false, score: 0, kind: "expression", level: 1, expr: "", reasons: [] };
  }

  // Pages are scanned again on every change, and most blocks of text do not
  // change between scans, so scores and splits are remembered by their text.
  var CACHE_CHARS = 2000000;
  var scoreCache = new Map(), extractCache = new Map(), cacheChars = 0;
  function remember(map, key, value) {
    cacheChars += key.length;
    if (cacheChars > CACHE_CHARS) { scoreCache.clear(); extractCache.clear(); cacheChars = key.length; }
    map.set(key, value);
    return value;
  }
  function scoreCached(text) {
    var key = String(text == null ? "" : text);
    var hit = scoreCache.get(key);
    return hit || remember(scoreCache, key, scoreFresh(key));
  }
  // public: a copy, so a caller that edits the result cannot change the cache
  function scoreText(text) {
    var r = scoreCached(text);
    return { isAlgebra: r.isAlgebra, score: r.score, kind: r.kind, level: r.level, expr: r.expr, reasons: r.reasons.slice() };
  }

  function scoreFresh(text) {
    var res = emptyResult();
    var raw = String(text == null ? "" : text);
    if (!raw.trim()) return res;
    var lines = raw.split(/\r?\n/).map(normalizeMath).join("\n");
    var code = codeSignal(lines);
    if (code) { res.reasons.push("code:" + code); return res; }
    var prepped = prepText(raw);
    var low = prepped.toLowerCase();
    var toks = tokenize(prepped);
    var spans = buildSpans(toks).map(analyzeSpan);
    if (!spans.length) { res.reasons.push("no-math"); return res; }

    var instr = hasInstruction(low);
    var proseWords = 0;
    for (var w = 0; w < toks.length; w++) if (toks[w].k === "w" && toks[w].role === "brk" && toks[w].v.length >= 2) proseWords++;

    var best = 0, bestSpan = null, i, sp;
    for (i = 0; i < spans.length; i++) if (spans[i].score > best) { best = spans[i].score; bestSpan = spans[i]; }
    if (bestSpan) res.reasons.push(bestSpan.valid ? (bestSpan.trivial ? "trivial-relation" : "relation") : "expression");
    if (instr && best >= 0.25) { best = Math.min(0.95, best + 0.35); res.reasons.push("instruction"); }

    // systems: two or more equations or inequalities sharing variables
    var eqSpans = spans.filter(function (s) { return s.valid && !s.trivial && !(s.defLike && countKeys(s.F.fnNames)); });
    // a system shares its unknowns: "log a = 0.6, log b = 0.9" is not one
    var sysVars = {}, shared = false;
    eqSpans.forEach(function (s) { for (var k in s.F.vars) { if (sysVars[k]) shared = true; sysVars[k] = 1; } });
    var isSystem = (eqSpans.length >= 2 && countKeys(sysVars) >= 2 && shared) ||
      spans.some(function (s) { return s.valid && s.eqCount >= 2 && countKeys(s.F.vars) >= 2; }) ||
      (/\bsystems?\b/.test(low) && eqSpans.length >= 1 && countKeys(sysVars) >= 2);
    if (isSystem) { best = Math.max(best, 0.85); res.reasons.push("system"); }

    var points = 0, list = false;
    spans.forEach(function (s) { points += s.F.points; if (s.F.list) list = true; });
    var linePoints = points >= 1 && /\b(slopes?|lines?|through|passes|points?|vertices|coordinates)\b/.test(low) && (points >= 2 || /\bslopes?\b|\bm\s*=/.test(low));
    if (linePoints) { best = Math.max(best, 0.7); res.reasons.push("line-points"); }
    var seqWords = KW_SEQ.test(low) || (/\b(sum|pattern|next number|term|terms)\b/.test(low) && prepped.indexOf("...") >= 0);
    var seqHit = seqWords && (list || /\b[atu]_\(?(?:n|\d)/.test(prepped));
    if (seqHit) { best = Math.max(best, 0.7); res.reasons.push("sequence"); }

    var story = STORY.test(low) && STORY_CUE.test(low) && proseWords >= 12;
    var varWork = spans.some(function (s) { return s.hasVar && ((s.F.ops > 0 && s.F.nums > 0) || (s.valid && !s.trivial)); });
    if (story && varWork) { best = Math.max(best, 0.6); res.reasons.push("word-problem"); }
    // "Translate and solve: n divided by 8 is -32", "Three-fourths of p is 18"
    var verbal = false;
    if (best < 0.5 && raw.length <= 220 && proseWords <= 25 && (/\btranslate\b/.test(low) || IMPERATIVE.test(low)) && VERBAL_OP.test(low) && VERBAL_REL.test(low) && /\d|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|half|twice)\b/.test(low) &&
        toks.some(function (t) { return t.role === "var" && t.v.length === 1 && !/^[aAI]$/.test(t.v); })) {
      verbal = true; best = Math.max(best, 0.65); res.reasons.push("verbal-equation");
    }

    // Caps: page text that carries math but is not a problem to solve. They run
    // last so no boost above can lift a formula, a worked step or an
    // encyclopedia paragraph back over the line.
    var cap = verbal ? 1 : capFor(raw, low, spans, bestSpan, {
      instr: instr, proseWords: proseWords, isSystem: isSystem, linePoints: linePoints, seqWords: seqWords,
      seqHit: seqHit, story: story && varWork
    }, res.reasons);
    if (cap < best) best = cap;

    res.score = Math.round(best * 100) / 100;
    res.isAlgebra = best >= 0.5;

    // significant spans feed expr, kind and level
    var sig = spans.filter(function (s) {
      return s.score >= 0.25 || (s.valid && !s.trivial) || s.F.points || (s.F.list && seqWords) || s.F.fnEvals;
    });
    if (!sig.length && bestSpan) sig = [bestSpan];
    res.expr = sig.map(function (s) { return s.text; }).join("; ").slice(0, 400);
    var ck = classify(sig, low, { isSystem: isSystem, story: story && varWork, list: list, seqWords: seqWords, points: points });
    if (verbal) ck.kind = "linear-equation";
    res.kind = ck.kind;
    res.level = ck.level;
    return res;
  }

  function classify(sig, low, ctx) {
    var A = {
      vars: {}, fnNames: {}, rel: false, solveRel: false, ineq: false, deg: 0, conic: false, log: false,
      sigma: false, ellipsis: false, radVar: false, radNeg: false, rad: false, absVar: false, varExp: false,
      expE: false, ratVar: false, groupsPM: 0, groupProduct: false, groupGroup: false, terms: 1, fnEvals: 0
    };
    sig.forEach(function (s) {
      var F = s.F;
      for (var k in F.vars) A.vars[k] = 1;
      for (var f in F.fnNames) A.fnNames[f] = 1;
      if (s.valid && !s.trivial) {
        A.rel = true;
        if (!s.defLike) A.solveRel = true;
        if (s.ineq) A.ineq = true;
        if (countKeys(F.sq) >= 2) A.conic = true;
      }
      if (F.deg > A.deg) A.deg = F.deg;
      if (F.terms > A.terms) A.terms = F.terms;
      ["log", "sigma", "ellipsis", "radVar", "radNeg", "rad", "absVar", "varExp", "expE", "ratVar", "groupProduct", "groupGroup"].forEach(function (key) {
        if (F[key]) A[key] = true;
      });
      A.groupsPM += F.groupsPM;
      A.fnEvals += F.fnEvals;
    });
    var nVars = countKeys(A.vars);
    var onlyI = nVars >= 1 && countKeys(A.vars) === 1 && A.vars.i === 1;
    var inverse = INVERSE_RE.test(low);
    var composite = COMPOSITE_RE.test(low);
    var fnConcept = KW_FUNC.test(low) || inverse || composite || A.fnEvals > 0 || (/\{/.test(low) && /\bif\b/.test(low) && countKeys(A.fnNames) > 0);
    var series = A.sigma || KW_SERIES.test(low) || (ctx.list && /\bsum\b/.test(low) && /\+/.test(low));
    var complex = onlyI || A.radNeg || KW_COMPLEX.test(low);
    var polyDiv = KW_POLYDIV.test(low);
    var literal = KW_LITERAL.test(low) && nVars >= 3;
    var kind;
    var seqNotation = ctx.seqWords && /\b[atu]_/.test(low);
    if (ctx.isSystem && !seqNotation) kind = "system";
    else if (fnConcept) kind = "function";
    else if (A.log || /\blogarithm/.test(low)) kind = "logarithmic";
    else if (A.sigma || (ctx.seqWords && (ctx.list || A.ellipsis || /\b[atu]_/.test(low) || /\bterm\b/.test(low)))) kind = "sequence";
    else if (complex) kind = "complex";
    else if (A.absVar) kind = "absolute-value";
    else if (A.varExp) kind = "exponential";
    else if (polyDiv && nVars) kind = "polynomial";
    else if (A.radVar || (A.rad && !nVars)) kind = "radical";
    else if (A.ratVar) kind = "rational";
    else if (KW_FACTOR.test(low) && !A.rel) kind = "factoring";
    else if (A.rel) {
      if (literal) kind = "linear-equation";
      else if (A.conic) kind = "quadratic";
      else if (A.deg >= 3) kind = "polynomial";
      else if (A.deg === 2) kind = "quadratic";
      else if (A.ineq) kind = "linear-inequality";
      else kind = "linear-equation";
    } else if (KW_QUAD.test(low) && A.deg >= 2) kind = "quadratic";
    else if (A.groupGroup || (A.deg >= 2 && (A.groupsPM >= 1 || A.terms >= 3)) || /\b(polynomials?|foil|binomials?|trinomials?)\b/.test(low)) kind = "polynomial";
    else if (KW_LINE.test(low) && (ctx.points || A.rel || nVars)) kind = "linear-equation";
    else if (ctx.points && KW_LINE.test(low)) kind = "linear-equation";
    else kind = "expression";

    var level = 1;
    if (A.log || kind === "logarithmic") level = 2;
    if (kind === "complex") level = 2;
    if (A.ratVar) level = 2;
    if (A.radVar && A.solveRel) level = 2;
    if (A.varExp && A.expE) level = 2;
    if (inverse || composite) level = 2;
    if (series) level = 2;
    if (A.conic) level = 2;
    if (polyDiv && nVars) level = 2;
    if (kind === "polynomial" && A.rel && A.deg >= 3) level = 2;
    if (kind === "factoring" && A.deg >= 3 && !/\bgcf\b|greatest common factor/.test(low)) level = 2;
    if (kind === "polynomial" && (A.deg >= 4 || /binomial theorem/.test(low))) level = 2;
    if (kind === "system" && (nVars >= 3 || A.deg >= 2)) level = 2;
    if (ctx.story) kind = "word-problem";
    return { kind: kind, level: level };
  }

  // ---------------------------------------------------------------------------
  // extractProblems: split a block of text into separate problems
  // ---------------------------------------------------------------------------
  var MAX_TEXT = 600;
  var MARKER_RE = /^(?:\(?\d{1,2}[.)]|\(?[a-hA-H]\)|(?:Q|Problem|Question|Exercise|Ex\.?)\s*#?\d{1,3}[.:)]?)(?=\s)/;

  var MATH_BEFORE = /(?:\b(?:log|ln|sin|cos|tan|sqrt|exp|abs)(?:_\w+)?|[=+\-*\/^<>\u2264\u2265\u2260(,\u221A]|(?:^|[^A-Za-z])[A-Za-z])\s*$/;
  // "a 3(x + 5) = 2x" or "b (m - 2)/3 = 1": a part letter in front of an equation
  var PART_LETTER = /^([a-h])\s+(?=[-\d(\u221A\u221B\u221C|][^\n]*[=<>\u2264\u2265])/;

  function splitMarkers(line) {
    line = line.replace(PART_LETTER, "$1) ");
    var pieces = [], depth = 0, last = 0, marker = null;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (ch === "(" ) {
        if (depth === 0 && (i === 0 || /\s/.test(line[i - 1])) && !MATH_BEFORE.test(line.slice(Math.max(0, i - 12), i))) {
          var mm0 = MARKER_RE.exec(line.slice(i));
          if (mm0 && /^\(/.test(mm0[0]) && /\)$/.test(mm0[0])) {
            if (i > last) pieces.push({ marker: marker, body: line.slice(last, i) });
            marker = mm0[0]; i += mm0[0].length - 1; last = i + 1; continue;
          }
        }
        depth++; continue;
      }
      if (ch === ")") { if (depth > 0) depth--; continue; }
      if (depth !== 0) continue;
      if (i !== 0 && !/\s/.test(line[i - 1])) continue;
      var mm = MARKER_RE.exec(line.slice(i));
      if (!mm) continue;
      var tok = mm[0];
      if (/^[a-hA-H]\)$/.test(tok) || /^\d{1,2}[.)]$/.test(tok) || /^(?:Q|Problem|Question|Exercise|Ex)/i.test(tok)) {
        // a single letter marker must sit at the start of the line or after a sentence end
        if (/^[a-hA-H]\)$/.test(tok) && i > 0 && !/[.:;?!)]\s*$/.test(line.slice(0, i)) && !/\d\s*$/.test(line.slice(0, i))) continue;
        // "2." mid-sentence is a marker only when the previous piece already holds math or ends a sentence
        if (i > 0 && /^\d{1,2}\.$/.test(tok) && !/[0-9a-zA-Z)\].:;?!]\s*$/.test(line.slice(0, i))) continue;
        if (i > last) pieces.push({ marker: marker, body: line.slice(last, i) });
        marker = tok; i += tok.length - 1; last = i + 1;
      }
    }
    pieces.push({ marker: marker, body: line.slice(last) });
    return pieces.map(function (p) { return { marker: p.marker, body: p.body.trim() }; }).filter(function (p) { return p.body; });
  }

  function isInstructionOnly(text, scored) {
    var low = prepText(text).toLowerCase();
    if (text.length > 220) return false;
    if (scored && scored.isAlgebra) return false;
    return hasInstruction(low) || /\b(each|following|directions|instructions)\b/.test(low) && /\b(equation|expression|problem|polynomial|system|inequalit)/.test(low);
  }

  function windowText(text, expr) {
    if (text.length <= MAX_TEXT) return text;
    var sentences = text.split(/(?<=[.?!])\s+(?=[A-Z0-9(])/);
    var keep = [];
    for (var i = 0; i < sentences.length; i++) {
      if (scoreCached(sentences[i]).score >= 0.25) {
        if (i > 0 && keep.indexOf(i - 1) < 0) keep.push(i - 1);
        keep.push(i);
        if (i + 1 < sentences.length && /\?\s*$/.test(sentences[i + 1])) keep.push(i + 1);
      }
    }
    var out = "";
    for (var k = 0; k < keep.length; k++) {
      var next = (out ? out + " " : "") + sentences[keep[k]];
      if (next.length > MAX_TEXT) break;
      out = next;
    }
    if (!out) out = expr || text;
    return out.length > MAX_TEXT ? out.slice(0, MAX_TEXT).replace(/\s+\S*$/, "") : out;
  }

  function proseWordCount(prepped) {
    var toks = tokenize(prepped), n = 0;
    for (var i = 0; i < toks.length; i++) if (toks[i].k === "w" && toks[i].role === "brk" && toks[i].v.length >= 2) n++;
    return n;
  }

  function oneEquation(s) {
    return s && s.isAlgebra && /(^|; )[^;]*=/.test(s.expr) && s.expr.indexOf(";") < 0;
  }

  function extractProblems(text, opts) {
    opts = opts || {};
    var header = opts.header || "";
    var src = String(text == null ? "" : text);
    var lines = src.split(/\r?\n/).map(function (l) { return normalizeMath(l); }).filter(Boolean);
    var pieces = [];
    lines.forEach(function (line) { splitMarkers(line).forEach(function (p) { pieces.push(p); }); });

    // merge: instruction headers, numbered stubs and systems written on two lines
    var units = [];
    for (var i = 0; i < pieces.length; i++) {
      var p = pieces[i];
      var sc = scoreCached(p.body);
      var prev = units[units.length - 1];
      if (!p.marker && !sc.isAlgebra && isInstructionOnly(p.body, sc) && !(prev && prev.marker && !prev.score.isAlgebra)) {
        header = p.body;
        continue;
      }
      if (prev && !p.marker && prev.marker && !prev.score.isAlgebra) {
        prev.body += "\n" + p.body; prev.score = scoreCached(prev.body); continue;
      }
      if (prev && !p.marker && oneEquation(sc) && prev.score.isAlgebra &&
          (prev.score.kind === "system" || oneEquation(prev.score) || /\bsystem/i.test(prev.body)) && !/\n.*\n/.test(prev.body)) {
        var merged = prev.body + "\n" + p.body;
        var ms = scoreCached(merged);
        if (ms.kind === "system") { prev.body = merged; prev.score = ms; continue; }
      }
      if (prev && !p.marker && !sc.isAlgebra && /\bsystem/i.test(prev.body) && !prev.score.isAlgebra) {
        prev.body += "\n" + p.body; prev.score = scoreCached(prev.body); continue;
      }
      units.push({ marker: p.marker, body: p.body, score: sc, header: header });
    }

    var out = [];
    units.forEach(function (u) {
      var s = u.score, body = u.body;
      var bodyPrep = prepText(body);
      var ownInstr = hasInstruction(bodyPrep.toLowerCase());
      if (u.header && !ownInstr && (proseWordCount(bodyPrep) <= 4 || (body.length <= 90 && !/[?]/.test(body)))) {
        var withHeader = u.header + "\n" + body;
        var hs = scoreCached(withHeader);
        if (hs.isAlgebra && (hs.score >= s.score || !s.isAlgebra)) { s = hs; body = withHeader; }
      }
      if (!s.isAlgebra) return;
      var finalText = windowText(body, s.expr);
      // a long block is cut down to the sentences around its math; the cut must
      // still read as a problem on its own
      if (finalText !== body) {
        var ws = scoreCached(finalText);
        if (!ws.isAlgebra) return;
        s = ws;
      }
      out.push({ text: finalText, expr: s.expr, kind: s.kind, level: s.level, score: s.score });
    });
    return out;
  }

  // ---------------------------------------------------------------------------
  // findProblems: walk the DOM, read rendered math, group by block
  // ---------------------------------------------------------------------------
  var SKIP_TAGS = {
    script: 1, style: 1, noscript: 1, code: 1, pre: 1, textarea: 1, input: 1, select: 1, option: 1,
    button: 1, template: 1, iframe: 1, frame: 1, object: 1, embed: 1, canvas: 1, video: 1, audio: 1,
    svg: 1, head: 1, title: 1, meta: 1, link: 1, kbd: 1, samp: 1, "var": 0, nav: 1, datalist: 1
  };
  var BLOCK_TAGS = {
    p: 1, li: 1, td: 1, th: 1, label: 1, h1: 1, h2: 1, h3: 1, h4: 1, h5: 1, h6: 1, dd: 1, dt: 1,
    blockquote: 1, figcaption: 1, caption: 1, summary: 1, legend: 1, div: 1, section: 1, article: 1,
    main: 1, aside: 1, header: 1, footer: 1, form: 1, fieldset: 1, ul: 1, ol: 1, dl: 1, table: 1,
    thead: 1, tbody: 1, tfoot: 1, tr: 1, body: 1, center: 1, details: 1, address: 1, figure: 1, hr: 1
  };
  var BLOCK_ROLES = { heading: 1, listitem: 1, row: 1, cell: 1, gridcell: 1, paragraph: 1, article: 1, group: 1, region: 1, dialog: 1 };
  var CHOICE_ROLES = { radio: 1, checkbox: 1, option: 1, radiogroup: 1, listbox: 1, menuitemradio: 1, menuitemcheckbox: 1, switch: 1, button: 1, tab: 1, menu: 1, menubar: 1, navigation: 1 };
  var CHOICE_CLASS = /^(answers?|answer[_-]?(?:label|text|choice|choices|option|options|list)|choices?|choice[_-]\w+|options?|mc[_-]?(?:option|choice)s?|answer_input|select_answer|freebirdFormviewerComponentsQuestionRadioChoice|docssharedWizToggleLabeledContainer)$/i;
  var MJ2_SKIP_CLASS = /^(MathJax_Preview|MathJax|MathJax_Display|MathJax_SVG|MathJax_SVG_Display|MathJax_CHTML|MathJax_MathML|MJX_Assistive_MathML|MathJax_Processing|MathJax_Processed)$/;

  function classTokens(el) {
    var c = el.getAttribute && el.getAttribute("class");
    return c ? String(c).split(/\s+/) : [];
  }
  function hasClass(el, name) { return classTokens(el).indexOf(name) >= 0; }

  var CHOICE_HINT = /answer|choice|option|freebird|docsshared/i;
  function isChoice(el, cs, more) {
    var role = more === false ? null : el.getAttribute("role");
    if (role && CHOICE_ROLES[role]) return true;
    if (cs === undefined) cs = el.getAttribute("class") || "";
    if (cs && CHOICE_HINT.test(cs)) {
      var cls = cs.split(/\s+/);
      for (var i = 0; i < cls.length; i++) if (CHOICE_CLASS.test(cls[i])) return true;
    }
    var tag = el.localName;
    if (tag === "label") {
      if (el.querySelector && el.querySelector("input[type=radio],input[type=checkbox]")) return true;
      var f = el.getAttribute("for");
      if (f && el.ownerDocument) {
        var target = el.ownerDocument.getElementById(f);
        if (target && /^(radio|checkbox)$/i.test(target.getAttribute("type") || "")) return true;
      }
    }
    if ((tag === "li" || tag === "div") && el.querySelector) {
      var first = el.firstElementChild;
      if (first && first.localName === "input" && /^(radio|checkbox)$/i.test(first.getAttribute("type") || "")) return true;
    }
    return false;
  }

  // Measuring every element is the most expensive part of a scan, so sizes are
  // only read where hiding by size is likely: class names and inline styles of
  // the screen-reader-only and collapsed patterns, math islands, and (after the
  // walk) the ancestors of blocks that hold a problem.
  var HIDE_HINT = /sr-only|sr_only|visually-?hidden|screen-?reader|offscreen|off-screen|a11y|assistive|clip|collaps|hidden|invisible|hide|accordion|toggle|spoiler|answer|solution|reveal/i;
  var STYLE_HINT = /clip|absolute|height\s*:\s*0|width\s*:\s*0|overflow|max-height/i;
  function isHidden(el, win, visibleOnly, island, cls, more) {
    if (more !== false) {
      if (el.hasAttribute("hidden")) return true;
      if (!island && el.getAttribute("aria-hidden") === "true") return true;
    }
    if (!visibleOnly || !win) return false;
    if (typeof el.checkVisibility === "function") {
      if (!el.checkVisibility({ checkVisibilityCSS: true, visibilityProperty: true })) return true;
    } else {
      var cs0 = win.getComputedStyle(el);
      if (cs0.display === "none" || cs0.visibility === "hidden" || cs0.visibility === "collapse") return true;
    }
    if (!island && !(cls && HIDE_HINT.test(cls))) {
      var st = more === false ? null : el.getAttribute("style");
      if (!st || !STYLE_HINT.test(st)) return false;
    }
    return sizeHidden(el, win);
  }
  // zero size with clipping, the 1px screen-reader box, a collapsed panel
  function sizeHidden(el, win) {
    if (!win || typeof el.getBoundingClientRect !== "function") return false;
    var cs = null;
    var r = el.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1) {
      cs = cs || win.getComputedStyle(el);
      if (cs.display === "contents") return false;
      if (r.width === 0 && r.height === 0 && el.getClientRects().length === 0) return cs.display !== "inline" || !el.textContent.trim() ? true : false;
      if (/hidden|clip/.test(cs.overflow + " " + cs.overflowX + " " + cs.overflowY)) return true;
      if (cs.clip && /rect\(0(px)?,? ?0(px)?/.test(cs.clip)) return true;
      if (cs.clipPath && /inset\(50%\)/.test(cs.clipPath)) return true;
      if (r.width <= 1 && r.height <= 1 && cs.position === "absolute") return true;
    }
    return false;
  }

  function stripDollars(s) {
    return String(s || "").trim().replace(/^LaTeX:\s*/i, "").replace(/^\$\$?|\$\$?$/g, "").replace(/^\\\(|\\\)$/g, "");
  }

  // Returns converted math text when el is a rendered math island, "" when the
  // element is a duplicate rendering that should be skipped, or null otherwise.
  var ISLAND_HINT = /katex|MathJax|MJX|mq-math-mode/;
  function mathIsland(el, tag, cs) {
    if (cs === undefined) cs = el.getAttribute("class") || "";
    if (tag !== "mjx-container" && tag !== "math" && tag !== "img" && !(cs && ISLAND_HINT.test(cs))) return null;
    var cls = cs ? cs.split(/\s+/) : [];
    if (cls.indexOf("katex") >= 0) {
      var tex = texAnnotation(el);
      if (tex) return texToText(tex);
      var m = el.querySelector(".katex-mathml math") || el.querySelector("math");
      if (m) return mathmlToText(m);
      var html = el.querySelector(".katex-html");
      return html ? normalizeMath(html.textContent) : "";
    }
    if (tag === "mjx-container") {
      var am = el.querySelector("mjx-assistive-mml math") || el.querySelector("math");
      if (am) return mathmlToText(am);
      var lt = el.getAttribute("data-latex") || el.getAttribute("data-tex");
      if (lt) return texToText(lt);
      return "";
    }
    if (tag === "math") return mathmlToText(el);
    for (var i = 0; i < cls.length; i++) {
      if (MJ2_SKIP_CLASS.test(cls[i])) {
        if (cls[i] === "MathJax_Preview") return "";
        // rendered MathJax 2 output: the following <script type="math/tex"> carries the source
        var sib = el.nextElementSibling;
        while (sib && sib.localName !== "script" && MJ2_SKIP_CLASS.test(classTokens(sib)[0] || "")) sib = sib.nextElementSibling;
        if (sib && sib.localName === "script" && /^math\//i.test(sib.getAttribute("type") || "")) return "";
        var inner = el.querySelector("math");
        return inner ? mathmlToText(inner) : "";
      }
    }
    if (cls.indexOf("mq-math-mode") >= 0) {
      if (cls.indexOf("mq-editable-field") >= 0) return "";
      var selc = el.querySelector(".mq-selectable");
      if (selc && selc.textContent.trim()) return texToText(stripDollars(selc.textContent));
      var rootBlock = el.querySelector(".mq-root-block");
      return normalizeMath(rootBlock ? rootBlock.textContent : el.getAttribute("aria-label") || "");
    }
    if (tag === "img") {
      var alt = el.getAttribute("alt") || "";
      var src = el.getAttribute("data-equation-content") || el.getAttribute("data-latex") || el.getAttribute("data-tex") || "";
      var isMathImg = /\bmath|latex|tex\b|equation/i.test(cls.join(" ")) || /^\s*\{?\\displaystyle/.test(alt) || /^LaTeX:/i.test(alt) || !!src;
      if (isMathImg && (src || alt)) return texToText(stripDollars(src || alt));
      return "";
    }
    return null;
  }

  function isBlock(el, tag, win, more) {
    if (BLOCK_TAGS[tag]) return true;
    var role = more === false ? null : el.getAttribute("role");
    if (role && BLOCK_ROLES[role]) return true;
    if (tag.indexOf("-") > 0 && tag.indexOf("mjx") !== 0 && win) {
      var d = win.getComputedStyle(el).display;
      return /^(block|flex|grid|list-item|table|flow-root)/.test(d);
    }
    return false;
  }

  // Wikipedia style citation marks: <sup class="reference">[12]</sup>
  function isCitation(el) {
    if (/reference|noprint|cite|footnote|endnote|fn-?ref/i.test(el.getAttribute("class") || "")) return true;
    var t = el.textContent || "";
    return t.length <= 16 && /^\s*\[[^\]]*\]\s*$/.test(t);
  }
  // "Solution", "Show Answer", "Hint": links and toggles next to a problem
  var TOGGLE_TAGS = { a: 1, span: 1, summary: 1, small: 1, strong: 1, b: 1, em: 1, i: 1, u: 1, font: 1 };
  var TOGGLE_TEXT = /^\s*(?:(?:show|hide|view|see|check|reveal|toggle)\s+(?:the\s+|all\s+)?)?(?:solutions?|answers?|hints?|steps?|explanation|work)\s*$/i;
  function isToggleLabel(el, tag) {
    if (!TOGGLE_TAGS[tag] || el.childElementCount > 2) return false;
    var f = el.firstChild;
    if (f && f.nodeType === 3 && f.nodeValue.length > 24) return false;
    var t = el.textContent;
    return t.length <= 24 && TOGGLE_TEXT.test(t);
  }
  // Fractions drawn with HTML: <span class="f"><u>x + 1</u><em>2</em></span> (Math is Fun),
  // <span class="frac"><span class="num">1</span><span class="den">2</span></span>
  var FRAC_CLASS = /^(?:f|frac|fraction|intbl|mfrac|dfrac|tfrac|sfrac|fract)$/i;
  var NUM_CLASS = /(?:^|\s)(?:num|numer|numerator|top)(?:\s|$)/i;
  var DEN_CLASS = /(?:^|\s)(?:den|denom|denominator|bottom|bot)(?:\s|$)/i;
  function fracParts(el, cs) {
    if (el.childElementCount !== 2) return null;
    var kids = el.children;
    if (cs === undefined) cs = el.getAttribute("class") || "";
    var cls = cs ? cs.split(/\s+/) : [], ok = false;
    for (var i = 0; i < cls.length; i++) if (FRAC_CLASS.test(cls[i])) ok = true;
    if (!ok) ok = NUM_CLASS.test(kids[0].getAttribute("class") || "") && DEN_CLASS.test(kids[1].getAttribute("class") || "");
    if (!ok) return null;
    for (var n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 3 && /\S/.test(n.nodeValue)) return null;
    return kids;
  }

  // Cheap test that a block of page text could hold a problem at all: a
  // relation, a power or root, a number glued to a letter (3x), an operator next
  // to a single letter (x + 1), a point, a number list or a function word.
  // Most prose fails it and skips the full scoring pass.
  var MATH_SEED = /[=<>\u2264\u2265\u2260^\u221A\u221B\u221C|\u03A3\u2211\u00B1]|\d[a-zA-Z\u03C0](?![a-zA-Z])|\d\s*[a-zA-Z]\s*[-+*\/=<>(]|(?:^|[^a-zA-Z])[a-zA-Z]\s*[-+*\/]\s*[\w(]|[\w)]\s*[-+*\/]\s*[a-zA-Z](?![a-zA-Z])|\(\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*\)|\d\s*,\s+\d+\s*,\s+\d|(?:^|[^a-zA-Z])(?:log|ln|sqrt|root|abs|sin|cos|tan)(?![a-zA-Z])|[-+*\/]\s*\(\s*-?[a-zA-Z](?![a-zA-Z])|\b[a-zA-Z]\s?\(\s*-?\d|\.\.\.|\u2026/;
  var INSTR_QUICK = /\b(?:solve|simplify|factor|evaluate|expand|foil|condense|rationalize|combine|complete|graph|rewrite|verify|classify|distribute|find|write|determine|calculate|compute|identify|state|express|what|which|multiply|divide|add|subtract|put|convert|change|give|directions|instructions|following|each|long|synthetic|quadratic)\b/i;
  // verbal algebra: "n divided by 8 is -32", "the product of -11 and y"
  var VERBAL_SEED = /\b(?:product|quotient)\b|\b(?:sum|difference) of\b|\bdivided by\b|\bmultiplied by\b|\b(?:more|less) than\b|-(?:halves|thirds?|fourths?|fifths?|sixths?|eighths?|tenths?) of\b/i;
  var LONE_LETTER = /(?:^|[^\w'\u2019])(?![aAI](?![\w'\u2019]))[a-zA-Z](?![\w'\u2019])/;
  function hasMathSeed(text) { return MATH_SEED.test(text) || (VERBAL_SEED.test(text) && LONE_LETTER.test(text)); }

  function extractCached(text, header) {
    var key = (header || "") + "\u0000" + text;
    var hit = extractCache.get(key);
    return hit || remember(extractCache, key, extractProblems(text, { header: header }));
  }

  function findProblems(root, opts) {
    opts = opts || {};
    var doc = root && root.nodeType === 9 ? root : root && root.ownerDocument ? root.ownerDocument : typeof document !== "undefined" ? document : null;
    if (!doc) return [];
    var start = !root || root.nodeType === 9 ? doc.body || doc.documentElement : root;
    if (!start) return [];
    var win = doc.defaultView || null;
    var visibleOnly = opts.visibleOnly !== false;
    var maxNodes = opts.maxNodes || 20000;
    var count = 0;
    var blocks = [];
    var top = { el: start, parts: [] };
    blocks.push(top);

    function inlineText(el) {
      var tmp = { el: el, parts: [] };
      walk(el, tmp, true);
      return normalizeMath(tmp.parts.join(""));
    }
    function walk(node, block, inlineOnly) {
      for (var c = node.firstChild; c; c = c.nextSibling) {
        if (count > maxNodes) return block;
        if (c.nodeType === 3) { block.parts.push(c.nodeValue); continue; }
        if (c.nodeType !== 1) continue;
        count++;
        var tag = String(c.localName || "").toLowerCase();
        if (tag === "script") {
          var ty = String(c.getAttribute("type") || "").toLowerCase();
          if (ty.indexOf("math/tex") === 0) { block.parts.push(" " + texToText(c.textContent) + " "); block.math = true; }
          continue;
        }
        if (SKIP_TAGS[tag]) continue;
        // Most elements carry no attribute but class: reading the others only
        // when they exist keeps the walk cheap on long pages.
        var na = c.attributes.length;
        var cs = na ? c.getAttribute("class") || "" : "";
        var more = na > (cs ? 1 : 0);
        if (more) {
          if (c.hasAttribute("data-algebridge-ui") || /^algebridge/i.test(c.id || "")) continue;
          var ce = c.getAttribute("contenteditable");
          if (ce !== null && ce !== "false") continue;
        }
        if (isChoice(c, cs, more)) continue;
        // video transcripts are speech about a problem, not the problem
        if ((cs && /transcript/i.test(cs)) || (more && (tag === "div" || tag === "section") && c.getAttribute("itemprop") === "transcript")) continue;
        var island = mathIsland(c, tag, cs);
        if (island !== null) {
          if (island && !isHidden(c, win, visibleOnly, true, cs, more)) { block.parts.push(" " + island + " "); block.math = true; }
          continue;
        }
        if (isHidden(c, win, visibleOnly, false, cs, more)) continue;
        if (tag === "br") { block.parts.push("\n"); continue; }
        if (tag === "sup" || tag === "sub") {
          if (tag === "sup" && isCitation(c)) continue;
          var inner = inlineText(c);
          if (inner) block.parts.push((tag === "sup" ? "^" : "_") + wrapScript(inner));
          continue;
        }
        if (isToggleLabel(c, tag)) continue;
        var frac = fracParts(c, cs);
        if (frac) {
          var fn = inlineText(frac[0]), fd = inlineText(frac[1]);
          if (fn && fd) { block.parts.push(" (" + fn + ")/(" + fd + ") "); continue; }
        }
        if (!inlineOnly && isBlock(c, tag, win, more)) {
          // the child block gets its own segment; text after it starts a new
          // segment of the parent so segments stay in document order
          var nb = { el: c, parts: [] };
          blocks.push(nb);
          walk(c, nb, false);
          var cont = { el: block.el, parts: [] };
          blocks.push(cont);
          block = cont;
          continue;
        }
        block = walk(c, block, inlineOnly);
      }
      return block;
    }
    walk(start, top, false);

    var results = [], seen = {}, seenExpr = {}, header = null, headerAge = 0, lastEq = null;
    var sizeMemo = new Map();
    function inCollapsed(el) {
      for (var e = el; e && e.nodeType === 1; e = e.parentElement) {
        var m = sizeMemo.get(e);
        if (m === undefined) { m = sizeHidden(e, win); sizeMemo.set(e, m); }
        if (m) return true;
        if (e === start) break;
      }
      return false;
    }
    for (var b = 0; b < blocks.length; b++) {
      var blk = blocks[b];
      var text = blk.parts.join("").split("\n").map(function (l) {
        return normalizeMath(l).replace(/\s+\*$/, "").replace(/\s+([.,;:?!])(?=\s|$)/g, "$1");
      }).filter(Boolean).join("\n");
      if (!text || text.length < 3 || !/[0-9A-Za-z]/.test(text)) continue;
      if (text.length > 20000) text = text.slice(0, 20000);
      if (opts._blocks) opts._blocks.push({ el: blk.el, text: text, header: header });
      var probs = blk.math || hasMathSeed(text) ? extractCached(text, header) : [];
      if (probs.length && visibleOnly && win && inCollapsed(blk.el)) probs = [];
      var ownInstr = probs.length > 0 && hasInstruction(text.toLowerCase());
      if (probs.length) {
        headerAge++;
        for (var k = 0; k < probs.length; k++) {
          var pr = probs[k];
          var t = pr.text.length > MAX_TEXT ? pr.text.slice(0, MAX_TEXT) : pr.text;
          var id = hash(normalizeMath(t));
          if (seen[id]) continue;
          seen[id] = 1;
          // the same math shown again (a worked solution restating the problem,
          // a collapsible "Show Solution" header) keeps only its first place
          var ek = String(pr.expr || "").replace(/\s+/g, "");
          if (ek.length >= 5 && /[=<>\u2264\u2265\u2260]/.test(ek)) {
            if (seenExpr[ek]) continue;
            seenExpr[ek] = 1;
          }
          // the next lines of a worked solution restate the last problem's
          // equation (2x + 3(x - 3) = 6, then 5x - 15 = 0): one problem, not six
          // A block with its own instruction ("Example: Solve 3(x + 2) = 15") is a
          // new problem even when its equation matches the last one.
          // A one-variable linear equation only counts as the same one when it
          // matches term for term, or when it is already part of a chain of steps,
          // or when it visibly carries a side of the last one: 3((2)/(3)x + 6) = 3(1).
          var eq = /=/.test(ek) ? equationOfText(pr.expr) : null;
          if (eq && lastEq && b - lastEq.block <= 80 && !ownInstr &&
              (sameEquation(lastEq.eq, eq, true) ||
               ((lastEq.chain || lastEq.sides.some(function (sd) { return sd.length >= 4 && ek.indexOf(sd) >= 0; })) && sameEquation(lastEq.eq, eq, false)))) {
            lastEq.block = b; lastEq.chain = true; continue;
          }
          if (eq) lastEq = { eq: eq, block: b, chain: false, sides: ek.split(/[=<>\u2264\u2265\u2260]/) };
          results.push({ id: id, text: t, expr: pr.expr, kind: pr.kind, level: pr.level, score: pr.score, element: blk.el });
        }
      } else if (text.length <= 220 && INSTR_QUICK.test(text) && isInstructionOnly(text, null)) {
        header = text; headerAge = 0;
      } else if (text.split(/\s+/).length > 8 || headerAge > 30) {
        header = null;
      }
    }
    return results;
  }

  // ---------------------------------------------------------------------------
  var api = {
    normalizeMath: normalizeMath,
    texToText: texToText,
    mathmlToText: mathmlToText,
    scoreText: scoreText,
    extractProblems: extractProblems,
    findProblems: findProblems,
    hash: hash,
    hasMathSeed: hasMathSeed,
    // internal helpers, exported for tests only
    _internal: {
      clearCache: function () { scoreCache.clear(); extractCache.clear(); prepCache.clear(); cacheChars = 0; prepChars = 0; },
      sameEquation: function (a, b, strict) { return sameEquation(equationOfText(a), equationOfText(b), !!strict); },
      isIdentity: function (t) {
        var sp = buildSpans(tokenize(prepText(t))).map(analyzeSpan).filter(function (x) { return x.valid; });
        return sp.length ? isIdentity(sp[0]) : null;
      }
    },
    version: 1
  };
  root.AlgeBridgeDetect = api;
  if (typeof module !== "undefined" && module && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : this);
