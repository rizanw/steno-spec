#!/usr/bin/env node
import { createRequire as __stenoCreateRequire } from 'node:module'; const require = __stenoCreateRequire(import.meta.url);
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/identity.js
var require_identity = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/identity.js"(exports) {
    "use strict";
    var ALIAS = /* @__PURE__ */ Symbol.for("yaml.alias");
    var DOC = /* @__PURE__ */ Symbol.for("yaml.document");
    var MAP = /* @__PURE__ */ Symbol.for("yaml.map");
    var PAIR = /* @__PURE__ */ Symbol.for("yaml.pair");
    var SCALAR = /* @__PURE__ */ Symbol.for("yaml.scalar");
    var SEQ = /* @__PURE__ */ Symbol.for("yaml.seq");
    var NODE_TYPE = /* @__PURE__ */ Symbol.for("yaml.node.type");
    var isAlias = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === ALIAS;
    var isDocument = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === DOC;
    var isMap2 = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === MAP;
    var isPair = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === PAIR;
    var isScalar2 = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SCALAR;
    var isSeq = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SEQ;
    function isCollection(node) {
      if (node && typeof node === "object")
        switch (node[NODE_TYPE]) {
          case MAP:
          case SEQ:
            return true;
        }
      return false;
    }
    function isNode(node) {
      if (node && typeof node === "object")
        switch (node[NODE_TYPE]) {
          case ALIAS:
          case MAP:
          case SCALAR:
          case SEQ:
            return true;
        }
      return false;
    }
    var hasAnchor = (node) => (isScalar2(node) || isCollection(node)) && !!node.anchor;
    exports.ALIAS = ALIAS;
    exports.DOC = DOC;
    exports.MAP = MAP;
    exports.NODE_TYPE = NODE_TYPE;
    exports.PAIR = PAIR;
    exports.SCALAR = SCALAR;
    exports.SEQ = SEQ;
    exports.hasAnchor = hasAnchor;
    exports.isAlias = isAlias;
    exports.isCollection = isCollection;
    exports.isDocument = isDocument;
    exports.isMap = isMap2;
    exports.isNode = isNode;
    exports.isPair = isPair;
    exports.isScalar = isScalar2;
    exports.isSeq = isSeq;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/visit.js
var require_visit = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/visit.js"(exports) {
    "use strict";
    var identity = require_identity();
    var BREAK = /* @__PURE__ */ Symbol("break visit");
    var SKIP = /* @__PURE__ */ Symbol("skip children");
    var REMOVE = /* @__PURE__ */ Symbol("remove node");
    function visit(node, visitor) {
      const visitor_ = initVisitor(visitor);
      if (identity.isDocument(node)) {
        const cd = visit_(null, node.contents, visitor_, Object.freeze([node]));
        if (cd === REMOVE)
          node.contents = null;
      } else
        visit_(null, node, visitor_, Object.freeze([]));
    }
    visit.BREAK = BREAK;
    visit.SKIP = SKIP;
    visit.REMOVE = REMOVE;
    function visit_(key, node, visitor, path2) {
      const ctrl = callVisitor(key, node, visitor, path2);
      if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key, path2, ctrl);
        return visit_(key, ctrl, visitor, path2);
      }
      if (typeof ctrl !== "symbol") {
        if (identity.isCollection(node)) {
          path2 = Object.freeze(path2.concat(node));
          for (let i = 0; i < node.items.length; ++i) {
            const ci = visit_(i, node.items[i], visitor, path2);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              node.items.splice(i, 1);
              i -= 1;
            }
          }
        } else if (identity.isPair(node)) {
          path2 = Object.freeze(path2.concat(node));
          const ck = visit_("key", node.key, visitor, path2);
          if (ck === BREAK)
            return BREAK;
          else if (ck === REMOVE)
            node.key = null;
          const cv = visit_("value", node.value, visitor, path2);
          if (cv === BREAK)
            return BREAK;
          else if (cv === REMOVE)
            node.value = null;
        }
      }
      return ctrl;
    }
    async function visitAsync(node, visitor) {
      const visitor_ = initVisitor(visitor);
      if (identity.isDocument(node)) {
        const cd = await visitAsync_(null, node.contents, visitor_, Object.freeze([node]));
        if (cd === REMOVE)
          node.contents = null;
      } else
        await visitAsync_(null, node, visitor_, Object.freeze([]));
    }
    visitAsync.BREAK = BREAK;
    visitAsync.SKIP = SKIP;
    visitAsync.REMOVE = REMOVE;
    async function visitAsync_(key, node, visitor, path2) {
      const ctrl = await callVisitor(key, node, visitor, path2);
      if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key, path2, ctrl);
        return visitAsync_(key, ctrl, visitor, path2);
      }
      if (typeof ctrl !== "symbol") {
        if (identity.isCollection(node)) {
          path2 = Object.freeze(path2.concat(node));
          for (let i = 0; i < node.items.length; ++i) {
            const ci = await visitAsync_(i, node.items[i], visitor, path2);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              node.items.splice(i, 1);
              i -= 1;
            }
          }
        } else if (identity.isPair(node)) {
          path2 = Object.freeze(path2.concat(node));
          const ck = await visitAsync_("key", node.key, visitor, path2);
          if (ck === BREAK)
            return BREAK;
          else if (ck === REMOVE)
            node.key = null;
          const cv = await visitAsync_("value", node.value, visitor, path2);
          if (cv === BREAK)
            return BREAK;
          else if (cv === REMOVE)
            node.value = null;
        }
      }
      return ctrl;
    }
    function initVisitor(visitor) {
      if (typeof visitor === "object" && (visitor.Collection || visitor.Node || visitor.Value)) {
        return Object.assign({
          Alias: visitor.Node,
          Map: visitor.Node,
          Scalar: visitor.Node,
          Seq: visitor.Node
        }, visitor.Value && {
          Map: visitor.Value,
          Scalar: visitor.Value,
          Seq: visitor.Value
        }, visitor.Collection && {
          Map: visitor.Collection,
          Seq: visitor.Collection
        }, visitor);
      }
      return visitor;
    }
    function callVisitor(key, node, visitor, path2) {
      if (typeof visitor === "function")
        return visitor(key, node, path2);
      if (identity.isMap(node))
        return visitor.Map?.(key, node, path2);
      if (identity.isSeq(node))
        return visitor.Seq?.(key, node, path2);
      if (identity.isPair(node))
        return visitor.Pair?.(key, node, path2);
      if (identity.isScalar(node))
        return visitor.Scalar?.(key, node, path2);
      if (identity.isAlias(node))
        return visitor.Alias?.(key, node, path2);
      return void 0;
    }
    function replaceNode(key, path2, node) {
      const parent = path2[path2.length - 1];
      if (identity.isCollection(parent)) {
        parent.items[key] = node;
      } else if (identity.isPair(parent)) {
        if (key === "key")
          parent.key = node;
        else
          parent.value = node;
      } else if (identity.isDocument(parent)) {
        parent.contents = node;
      } else {
        const pt = identity.isAlias(parent) ? "alias" : "scalar";
        throw new Error(`Cannot replace node with ${pt} parent`);
      }
    }
    exports.visit = visit;
    exports.visitAsync = visitAsync;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/doc/directives.js
var require_directives = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/doc/directives.js"(exports) {
    "use strict";
    var identity = require_identity();
    var visit = require_visit();
    var escapeChars = {
      "!": "%21",
      ",": "%2C",
      "[": "%5B",
      "]": "%5D",
      "{": "%7B",
      "}": "%7D"
    };
    var escapeTagName = (tn) => tn.replace(/[!,[\]{}]/g, (ch) => escapeChars[ch]);
    var Directives = class _Directives {
      constructor(yaml, tags) {
        this.docStart = null;
        this.docEnd = false;
        this.yaml = Object.assign({}, _Directives.defaultYaml, yaml);
        this.tags = Object.assign({}, _Directives.defaultTags, tags);
      }
      clone() {
        const copy = new _Directives(this.yaml, this.tags);
        copy.docStart = this.docStart;
        return copy;
      }
      /**
       * During parsing, get a Directives instance for the current document and
       * update the stream state according to the current version's spec.
       */
      atDocument() {
        const res = new _Directives(this.yaml, this.tags);
        switch (this.yaml.version) {
          case "1.1":
            this.atNextDocument = true;
            break;
          case "1.2":
            this.atNextDocument = false;
            this.yaml = {
              explicit: _Directives.defaultYaml.explicit,
              version: "1.2"
            };
            this.tags = Object.assign({}, _Directives.defaultTags);
            break;
        }
        return res;
      }
      /**
       * @param onError - May be called even if the action was successful
       * @returns `true` on success
       */
      add(line, onError) {
        if (this.atNextDocument) {
          this.yaml = { explicit: _Directives.defaultYaml.explicit, version: "1.1" };
          this.tags = Object.assign({}, _Directives.defaultTags);
          this.atNextDocument = false;
        }
        const parts = line.trim().split(/[ \t]+/);
        const name = parts.shift();
        switch (name) {
          case "%TAG": {
            if (parts.length !== 2) {
              onError(0, "%TAG directive should contain exactly two parts");
              if (parts.length < 2)
                return false;
            }
            const [handle, prefix] = parts;
            this.tags[handle] = prefix;
            return true;
          }
          case "%YAML": {
            this.yaml.explicit = true;
            if (parts.length !== 1) {
              onError(0, "%YAML directive should contain exactly one part");
              return false;
            }
            const [version2] = parts;
            if (version2 === "1.1" || version2 === "1.2") {
              this.yaml.version = version2;
              return true;
            } else {
              const isValid = /^\d+\.\d+$/.test(version2);
              onError(6, `Unsupported YAML version ${version2}`, isValid);
              return false;
            }
          }
          default:
            onError(0, `Unknown directive ${name}`, true);
            return false;
        }
      }
      /**
       * Resolves a tag, matching handles to those defined in %TAG directives.
       *
       * @returns Resolved tag, which may also be the non-specific tag `'!'` or a
       *   `'!local'` tag, or `null` if unresolvable.
       */
      tagName(source, onError) {
        if (source === "!")
          return "!";
        if (source[0] !== "!") {
          onError(`Not a valid tag: ${source}`);
          return null;
        }
        if (source[1] === "<") {
          const verbatim = source.slice(2, -1);
          if (verbatim === "!" || verbatim === "!!") {
            onError(`Verbatim tags aren't resolved, so ${source} is invalid.`);
            return null;
          }
          if (source[source.length - 1] !== ">")
            onError("Verbatim tags must end with a >");
          return verbatim;
        }
        const [, handle, suffix] = source.match(/^(.*!)([^!]*)$/s);
        if (!suffix)
          onError(`The ${source} tag has no suffix`);
        const prefix = this.tags[handle];
        if (prefix) {
          try {
            return prefix + decodeURIComponent(suffix);
          } catch (error) {
            onError(String(error));
            return null;
          }
        }
        if (handle === "!")
          return source;
        onError(`Could not resolve tag: ${source}`);
        return null;
      }
      /**
       * Given a fully resolved tag, returns its printable string form,
       * taking into account current tag prefixes and defaults.
       */
      tagString(tag) {
        for (const [handle, prefix] of Object.entries(this.tags)) {
          if (tag.startsWith(prefix))
            return handle + escapeTagName(tag.substring(prefix.length));
        }
        return tag[0] === "!" ? tag : `!<${tag}>`;
      }
      toString(doc) {
        const lines = this.yaml.explicit ? [`%YAML ${this.yaml.version || "1.2"}`] : [];
        const tagEntries = Object.entries(this.tags);
        let tagNames;
        if (doc && tagEntries.length > 0 && identity.isNode(doc.contents)) {
          const tags = {};
          visit.visit(doc.contents, (_key, node) => {
            if (identity.isNode(node) && node.tag)
              tags[node.tag] = true;
          });
          tagNames = Object.keys(tags);
        } else
          tagNames = [];
        for (const [handle, prefix] of tagEntries) {
          if (handle === "!!" && prefix === "tag:yaml.org,2002:")
            continue;
          if (!doc || tagNames.some((tn) => tn.startsWith(prefix)))
            lines.push(`%TAG ${handle} ${prefix}`);
        }
        return lines.join("\n");
      }
    };
    Directives.defaultYaml = { explicit: false, version: "1.2" };
    Directives.defaultTags = { "!!": "tag:yaml.org,2002:" };
    exports.Directives = Directives;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/doc/anchors.js
var require_anchors = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/doc/anchors.js"(exports) {
    "use strict";
    var identity = require_identity();
    var visit = require_visit();
    function anchorIsValid(anchor) {
      if (/[\x00-\x19\s,[\]{}]/.test(anchor)) {
        const sa = JSON.stringify(anchor);
        const msg = `Anchor must not contain whitespace or control characters: ${sa}`;
        throw new Error(msg);
      }
      return true;
    }
    function anchorNames(root) {
      const anchors = /* @__PURE__ */ new Set();
      visit.visit(root, {
        Value(_key, node) {
          if (node.anchor)
            anchors.add(node.anchor);
        }
      });
      return anchors;
    }
    function findNewAnchor(prefix, exclude) {
      for (let i = 1; true; ++i) {
        const name = `${prefix}${i}`;
        if (!exclude.has(name))
          return name;
      }
    }
    function createNodeAnchors(doc, prefix) {
      const aliasObjects = [];
      const sourceObjects = /* @__PURE__ */ new Map();
      let prevAnchors = null;
      return {
        onAnchor: (source) => {
          aliasObjects.push(source);
          prevAnchors ?? (prevAnchors = anchorNames(doc));
          const anchor = findNewAnchor(prefix, prevAnchors);
          prevAnchors.add(anchor);
          return anchor;
        },
        /**
         * With circular references, the source node is only resolved after all
         * of its child nodes are. This is why anchors are set only after all of
         * the nodes have been created.
         */
        setAnchors: () => {
          for (const source of aliasObjects) {
            const ref = sourceObjects.get(source);
            if (typeof ref === "object" && ref.anchor && (identity.isScalar(ref.node) || identity.isCollection(ref.node))) {
              ref.node.anchor = ref.anchor;
            } else {
              const error = new Error("Failed to resolve repeated object (this should not happen)");
              error.source = source;
              throw error;
            }
          }
        },
        sourceObjects
      };
    }
    exports.anchorIsValid = anchorIsValid;
    exports.anchorNames = anchorNames;
    exports.createNodeAnchors = createNodeAnchors;
    exports.findNewAnchor = findNewAnchor;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/doc/applyReviver.js
var require_applyReviver = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/doc/applyReviver.js"(exports) {
    "use strict";
    function applyReviver(reviver, obj, key, val) {
      if (val && typeof val === "object") {
        if (Array.isArray(val)) {
          for (let i = 0, len = val.length; i < len; ++i) {
            const v0 = val[i];
            const v1 = applyReviver(reviver, val, String(i), v0);
            if (v1 === void 0)
              delete val[i];
            else if (v1 !== v0)
              val[i] = v1;
          }
        } else if (val instanceof Map) {
          for (const k of Array.from(val.keys())) {
            const v0 = val.get(k);
            const v1 = applyReviver(reviver, val, k, v0);
            if (v1 === void 0)
              val.delete(k);
            else if (v1 !== v0)
              val.set(k, v1);
          }
        } else if (val instanceof Set) {
          for (const v0 of Array.from(val)) {
            const v1 = applyReviver(reviver, val, v0, v0);
            if (v1 === void 0)
              val.delete(v0);
            else if (v1 !== v0) {
              val.delete(v0);
              val.add(v1);
            }
          }
        } else {
          for (const [k, v0] of Object.entries(val)) {
            const v1 = applyReviver(reviver, val, k, v0);
            if (v1 === void 0)
              delete val[k];
            else if (v1 !== v0)
              val[k] = v1;
          }
        }
      }
      return reviver.call(obj, key, val);
    }
    exports.applyReviver = applyReviver;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/toJS.js
var require_toJS = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/toJS.js"(exports) {
    "use strict";
    var identity = require_identity();
    function toJS(value, arg, ctx) {
      if (Array.isArray(value))
        return value.map((v, i) => toJS(v, String(i), ctx));
      if (value && typeof value.toJSON === "function") {
        if (!ctx || !identity.hasAnchor(value))
          return value.toJSON(arg, ctx);
        const data = { aliasCount: 0, count: 1, res: void 0 };
        ctx.anchors.set(value, data);
        ctx.onCreate = (res2) => {
          data.res = res2;
          delete ctx.onCreate;
        };
        const res = value.toJSON(arg, ctx);
        if (ctx.onCreate)
          ctx.onCreate(res);
        return res;
      }
      if (typeof value === "bigint" && !ctx?.keep)
        return Number(value);
      return value;
    }
    exports.toJS = toJS;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/Node.js
var require_Node = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/Node.js"(exports) {
    "use strict";
    var applyReviver = require_applyReviver();
    var identity = require_identity();
    var toJS = require_toJS();
    var NodeBase = class {
      constructor(type) {
        Object.defineProperty(this, identity.NODE_TYPE, { value: type });
      }
      /** Create a copy of this node.  */
      clone() {
        const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /** A plain JavaScript representation of this node. */
      toJS(doc, { mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
        if (!identity.isDocument(doc))
          throw new TypeError("A document argument is required");
        const ctx = {
          anchors: /* @__PURE__ */ new Map(),
          doc,
          keep: true,
          mapAsMap: mapAsMap === true,
          mapKeyWarned: false,
          maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
        };
        const res = toJS.toJS(this, "", ctx);
        if (typeof onAnchor === "function")
          for (const { count, res: res2 } of ctx.anchors.values())
            onAnchor(res2, count);
        return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
      }
    };
    exports.NodeBase = NodeBase;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/Alias.js
var require_Alias = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/Alias.js"(exports) {
    "use strict";
    var anchors = require_anchors();
    var visit = require_visit();
    var identity = require_identity();
    var Node = require_Node();
    var toJS = require_toJS();
    var Alias = class extends Node.NodeBase {
      constructor(source) {
        super(identity.ALIAS);
        this.source = source;
        Object.defineProperty(this, "tag", {
          set() {
            throw new Error("Alias nodes cannot have tags");
          }
        });
      }
      /**
       * Resolve the value of this alias within `doc`, finding the last
       * instance of the `source` anchor before this node.
       */
      resolve(doc, ctx) {
        if (ctx?.maxAliasCount === 0)
          throw new ReferenceError("Alias resolution is disabled");
        let nodes;
        if (ctx?.aliasResolveCache) {
          nodes = ctx.aliasResolveCache;
        } else {
          nodes = [];
          visit.visit(doc, {
            Node: (_key, node) => {
              if (identity.isAlias(node) || identity.hasAnchor(node))
                nodes.push(node);
            }
          });
          if (ctx)
            ctx.aliasResolveCache = nodes;
        }
        let found = void 0;
        for (const node of nodes) {
          if (node === this)
            break;
          if (node.anchor === this.source)
            found = node;
        }
        if (found && ctx) {
          const { anchors: anchors2, doc: doc2, maxAliasCount } = ctx;
          let data = anchors2.get(found);
          if (!data) {
            toJS.toJS(found, null, ctx);
            data = anchors2.get(found);
          }
          if (data?.res === void 0) {
            const msg = "This should not happen: Alias anchor was not resolved?";
            throw new ReferenceError(msg);
          }
          if (maxAliasCount >= 0) {
            data.count += 1;
            if (data.aliasCount === 0)
              data.aliasCount = getAliasCount(doc2, found, anchors2);
            if (data.count * data.aliasCount > maxAliasCount) {
              const msg = "Excessive alias count indicates a resource exhaustion attack";
              throw new ReferenceError(msg);
            }
          }
        }
        return found;
      }
      toJSON(_arg, ctx) {
        if (!ctx)
          return { source: this.source };
        const source = this.resolve(ctx.doc, ctx);
        if (!source) {
          const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
          throw new ReferenceError(msg);
        }
        return ctx.anchors.get(source).res;
      }
      toString(ctx, _onComment, _onChompKeep) {
        const src = `*${this.source}`;
        if (ctx) {
          anchors.anchorIsValid(this.source);
          if (ctx.options.verifyAliasOrder && !ctx.anchors.has(this.source)) {
            const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
            throw new Error(msg);
          }
          if (ctx.implicitKey)
            return `${src} `;
        }
        return src;
      }
    };
    function getAliasCount(doc, node, anchors2) {
      if (identity.isAlias(node)) {
        const source = node.resolve(doc);
        const anchor = anchors2 && source && anchors2.get(source);
        return anchor ? anchor.count * anchor.aliasCount : 0;
      } else if (identity.isCollection(node)) {
        let count = 0;
        for (const item of node.items) {
          const c = getAliasCount(doc, item, anchors2);
          if (c > count)
            count = c;
        }
        return count;
      } else if (identity.isPair(node)) {
        const kc = getAliasCount(doc, node.key, anchors2);
        const vc = getAliasCount(doc, node.value, anchors2);
        return Math.max(kc, vc);
      }
      return 1;
    }
    exports.Alias = Alias;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/Scalar.js
var require_Scalar = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/Scalar.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Node = require_Node();
    var toJS = require_toJS();
    var isScalarValue = (value) => !value || typeof value !== "function" && typeof value !== "object";
    var Scalar = class extends Node.NodeBase {
      constructor(value) {
        super(identity.SCALAR);
        this.value = value;
      }
      toJSON(arg, ctx) {
        return ctx?.keep ? this.value : toJS.toJS(this.value, arg, ctx);
      }
      toString() {
        return String(this.value);
      }
    };
    Scalar.BLOCK_FOLDED = "BLOCK_FOLDED";
    Scalar.BLOCK_LITERAL = "BLOCK_LITERAL";
    Scalar.PLAIN = "PLAIN";
    Scalar.QUOTE_DOUBLE = "QUOTE_DOUBLE";
    Scalar.QUOTE_SINGLE = "QUOTE_SINGLE";
    exports.Scalar = Scalar;
    exports.isScalarValue = isScalarValue;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/doc/createNode.js
var require_createNode = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/doc/createNode.js"(exports) {
    "use strict";
    var Alias = require_Alias();
    var identity = require_identity();
    var Scalar = require_Scalar();
    var defaultTagPrefix = "tag:yaml.org,2002:";
    function findTagObject(value, tagName, tags) {
      if (tagName) {
        const match = tags.filter((t) => t.tag === tagName);
        const tagObj = match.find((t) => !t.format) ?? match[0];
        if (!tagObj)
          throw new Error(`Tag ${tagName} not found`);
        return tagObj;
      }
      return tags.find((t) => t.identify?.(value) && !t.format);
    }
    function createNode(value, tagName, ctx) {
      if (identity.isDocument(value))
        value = value.contents;
      if (identity.isNode(value))
        return value;
      if (identity.isPair(value)) {
        const map = ctx.schema[identity.MAP].createNode?.(ctx.schema, null, ctx);
        map.items.push(value);
        return map;
      }
      if (value instanceof String || value instanceof Number || value instanceof Boolean || typeof BigInt !== "undefined" && value instanceof BigInt) {
        value = value.valueOf();
      }
      const { aliasDuplicateObjects, onAnchor, onTagObj, schema, sourceObjects } = ctx;
      let ref = void 0;
      if (aliasDuplicateObjects && value && typeof value === "object") {
        ref = sourceObjects.get(value);
        if (ref) {
          ref.anchor ?? (ref.anchor = onAnchor(value));
          return new Alias.Alias(ref.anchor);
        } else {
          ref = { anchor: null, node: null };
          sourceObjects.set(value, ref);
        }
      }
      if (tagName?.startsWith("!!"))
        tagName = defaultTagPrefix + tagName.slice(2);
      let tagObj = findTagObject(value, tagName, schema.tags);
      if (!tagObj) {
        if (value && typeof value.toJSON === "function") {
          value = value.toJSON();
        }
        if (!value || typeof value !== "object") {
          const node2 = new Scalar.Scalar(value);
          if (ref)
            ref.node = node2;
          return node2;
        }
        tagObj = value instanceof Map ? schema[identity.MAP] : Symbol.iterator in Object(value) ? schema[identity.SEQ] : schema[identity.MAP];
      }
      if (onTagObj) {
        onTagObj(tagObj);
        delete ctx.onTagObj;
      }
      const node = tagObj?.createNode ? tagObj.createNode(ctx.schema, value, ctx) : typeof tagObj?.nodeClass?.from === "function" ? tagObj.nodeClass.from(ctx.schema, value, ctx) : new Scalar.Scalar(value);
      if (tagName)
        node.tag = tagName;
      else if (!tagObj.default)
        node.tag = tagObj.tag;
      if (ref)
        ref.node = node;
      return node;
    }
    exports.createNode = createNode;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/Collection.js
var require_Collection = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/Collection.js"(exports) {
    "use strict";
    var createNode = require_createNode();
    var identity = require_identity();
    var Node = require_Node();
    function collectionFromPath(schema, path2, value) {
      let v = value;
      for (let i = path2.length - 1; i >= 0; --i) {
        const k = path2[i];
        if (typeof k === "number" && Number.isInteger(k) && k >= 0) {
          const a = [];
          a[k] = v;
          v = a;
        } else {
          v = /* @__PURE__ */ new Map([[k, v]]);
        }
      }
      return createNode.createNode(v, void 0, {
        aliasDuplicateObjects: false,
        keepUndefined: false,
        onAnchor: () => {
          throw new Error("This should not happen, please report a bug.");
        },
        schema,
        sourceObjects: /* @__PURE__ */ new Map()
      });
    }
    var isEmptyPath = (path2) => path2 == null || typeof path2 === "object" && !!path2[Symbol.iterator]().next().done;
    var Collection = class extends Node.NodeBase {
      constructor(type, schema) {
        super(type);
        Object.defineProperty(this, "schema", {
          value: schema,
          configurable: true,
          enumerable: false,
          writable: true
        });
      }
      /**
       * Create a copy of this collection.
       *
       * @param schema - If defined, overwrites the original's schema
       */
      clone(schema) {
        const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
        if (schema)
          copy.schema = schema;
        copy.items = copy.items.map((it) => identity.isNode(it) || identity.isPair(it) ? it.clone(schema) : it);
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /**
       * Adds a value to the collection. For `!!map` and `!!omap` the value must
       * be a Pair instance or a `{ key, value }` object, which may not have a key
       * that already exists in the map.
       */
      addIn(path2, value) {
        if (isEmptyPath(path2))
          this.add(value);
        else {
          const [key, ...rest] = path2;
          const node = this.get(key, true);
          if (identity.isCollection(node))
            node.addIn(rest, value);
          else if (node === void 0 && this.schema)
            this.set(key, collectionFromPath(this.schema, rest, value));
          else
            throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
        }
      }
      /**
       * Removes a value from the collection.
       * @returns `true` if the item was found and removed.
       */
      deleteIn(path2) {
        const [key, ...rest] = path2;
        if (rest.length === 0)
          return this.delete(key);
        const node = this.get(key, true);
        if (identity.isCollection(node))
          return node.deleteIn(rest);
        else
          throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
      }
      /**
       * Returns item at `key`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      getIn(path2, keepScalar) {
        const [key, ...rest] = path2;
        const node = this.get(key, true);
        if (rest.length === 0)
          return !keepScalar && identity.isScalar(node) ? node.value : node;
        else
          return identity.isCollection(node) ? node.getIn(rest, keepScalar) : void 0;
      }
      hasAllNullValues(allowScalar) {
        return this.items.every((node) => {
          if (!identity.isPair(node))
            return false;
          const n = node.value;
          return n == null || allowScalar && identity.isScalar(n) && n.value == null && !n.commentBefore && !n.comment && !n.tag;
        });
      }
      /**
       * Checks if the collection includes a value with the key `key`.
       */
      hasIn(path2) {
        const [key, ...rest] = path2;
        if (rest.length === 0)
          return this.has(key);
        const node = this.get(key, true);
        return identity.isCollection(node) ? node.hasIn(rest) : false;
      }
      /**
       * Sets a value in this collection. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      setIn(path2, value) {
        const [key, ...rest] = path2;
        if (rest.length === 0) {
          this.set(key, value);
        } else {
          const node = this.get(key, true);
          if (identity.isCollection(node))
            node.setIn(rest, value);
          else if (node === void 0 && this.schema)
            this.set(key, collectionFromPath(this.schema, rest, value));
          else
            throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
        }
      }
    };
    exports.Collection = Collection;
    exports.collectionFromPath = collectionFromPath;
    exports.isEmptyPath = isEmptyPath;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyComment.js
var require_stringifyComment = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyComment.js"(exports) {
    "use strict";
    var stringifyComment = (str) => str.replace(/^(?!$)(?: $)?/gm, "#");
    function indentComment(comment, indent) {
      if (/^\n+$/.test(comment))
        return comment.substring(1);
      return indent ? comment.replace(/^(?! *$)/gm, indent) : comment;
    }
    var lineComment = (str, indent, comment) => str.endsWith("\n") ? indentComment(comment, indent) : comment.includes("\n") ? "\n" + indentComment(comment, indent) : (str.endsWith(" ") ? "" : " ") + comment;
    exports.indentComment = indentComment;
    exports.lineComment = lineComment;
    exports.stringifyComment = stringifyComment;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/foldFlowLines.js
var require_foldFlowLines = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/foldFlowLines.js"(exports) {
    "use strict";
    var FOLD_FLOW = "flow";
    var FOLD_BLOCK = "block";
    var FOLD_QUOTED = "quoted";
    function foldFlowLines(text, indent, mode = "flow", { indentAtStart, lineWidth = 80, minContentWidth = 20, onFold, onOverflow } = {}) {
      if (!lineWidth || lineWidth < 0)
        return text;
      if (lineWidth < minContentWidth)
        minContentWidth = 0;
      const endStep = Math.max(1 + minContentWidth, 1 + lineWidth - indent.length);
      if (text.length <= endStep)
        return text;
      const folds = [];
      const escapedFolds = {};
      let end = lineWidth - indent.length;
      if (typeof indentAtStart === "number") {
        if (indentAtStart > lineWidth - Math.max(2, minContentWidth))
          folds.push(0);
        else
          end = lineWidth - indentAtStart;
      }
      let split = void 0;
      let prev = void 0;
      let overflow = false;
      let i = -1;
      let escStart = -1;
      let escEnd = -1;
      if (mode === FOLD_BLOCK) {
        i = consumeMoreIndentedLines(text, i, indent.length);
        if (i !== -1)
          end = i + endStep;
      }
      for (let ch; ch = text[i += 1]; ) {
        if (mode === FOLD_QUOTED && ch === "\\") {
          escStart = i;
          switch (text[i + 1]) {
            case "x":
              i += 3;
              break;
            case "u":
              i += 5;
              break;
            case "U":
              i += 9;
              break;
            default:
              i += 1;
          }
          escEnd = i;
        }
        if (ch === "\n") {
          if (mode === FOLD_BLOCK)
            i = consumeMoreIndentedLines(text, i, indent.length);
          end = i + indent.length + endStep;
          split = void 0;
        } else {
          if (ch === " " && prev && prev !== " " && prev !== "\n" && prev !== "	") {
            const next = text[i + 1];
            if (next && next !== " " && next !== "\n" && next !== "	")
              split = i;
          }
          if (i >= end) {
            if (split) {
              folds.push(split);
              end = split + endStep;
              split = void 0;
            } else if (mode === FOLD_QUOTED) {
              while (prev === " " || prev === "	") {
                prev = ch;
                ch = text[i += 1];
                overflow = true;
              }
              const j = i > escEnd + 1 ? i - 2 : escStart - 1;
              if (escapedFolds[j])
                return text;
              folds.push(j);
              escapedFolds[j] = true;
              end = j + endStep;
              split = void 0;
            } else {
              overflow = true;
            }
          }
        }
        prev = ch;
      }
      if (overflow && onOverflow)
        onOverflow();
      if (folds.length === 0)
        return text;
      if (onFold)
        onFold();
      let res = text.slice(0, folds[0]);
      for (let i2 = 0; i2 < folds.length; ++i2) {
        const fold = folds[i2];
        const end2 = folds[i2 + 1] || text.length;
        if (fold === 0)
          res = `
${indent}${text.slice(0, end2)}`;
        else {
          if (mode === FOLD_QUOTED && escapedFolds[fold])
            res += `${text[fold]}\\`;
          res += `
${indent}${text.slice(fold + 1, end2)}`;
        }
      }
      return res;
    }
    function consumeMoreIndentedLines(text, i, indent) {
      let end = i;
      let start = i + 1;
      let ch = text[start];
      while (ch === " " || ch === "	") {
        if (i < start + indent) {
          ch = text[++i];
        } else {
          do {
            ch = text[++i];
          } while (ch && ch !== "\n");
          end = i;
          start = i + 1;
          ch = text[start];
        }
      }
      return end;
    }
    exports.FOLD_BLOCK = FOLD_BLOCK;
    exports.FOLD_FLOW = FOLD_FLOW;
    exports.FOLD_QUOTED = FOLD_QUOTED;
    exports.foldFlowLines = foldFlowLines;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyString.js
var require_stringifyString = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyString.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var foldFlowLines = require_foldFlowLines();
    var getFoldOptions = (ctx, isBlock) => ({
      indentAtStart: isBlock ? ctx.indent.length : ctx.indentAtStart,
      lineWidth: ctx.options.lineWidth,
      minContentWidth: ctx.options.minContentWidth
    });
    var containsDocumentMarker = (str) => /^(%|---|\.\.\.)/m.test(str);
    function lineLengthOverLimit(str, lineWidth, indentLength) {
      if (!lineWidth || lineWidth < 0)
        return false;
      const limit = lineWidth - indentLength;
      const strLen = str.length;
      if (strLen <= limit)
        return false;
      for (let i = 0, start = 0; i < strLen; ++i) {
        if (str[i] === "\n") {
          if (i - start > limit)
            return true;
          start = i + 1;
          if (strLen - start <= limit)
            return false;
        }
      }
      return true;
    }
    function doubleQuotedString(value, ctx) {
      const json2 = JSON.stringify(value);
      if (ctx.options.doubleQuotedAsJSON)
        return json2;
      const { implicitKey } = ctx;
      const minMultiLineLength = ctx.options.doubleQuotedMinMultiLineLength;
      const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
      let str = "";
      let start = 0;
      for (let i = 0, ch = json2[i]; ch; ch = json2[++i]) {
        if (ch === " " && json2[i + 1] === "\\" && json2[i + 2] === "n") {
          str += json2.slice(start, i) + "\\ ";
          i += 1;
          start = i;
          ch = "\\";
        }
        if (ch === "\\")
          switch (json2[i + 1]) {
            case "u":
              {
                str += json2.slice(start, i);
                const code = json2.substr(i + 2, 4);
                switch (code) {
                  case "0000":
                    str += "\\0";
                    break;
                  case "0007":
                    str += "\\a";
                    break;
                  case "000b":
                    str += "\\v";
                    break;
                  case "001b":
                    str += "\\e";
                    break;
                  case "0085":
                    str += "\\N";
                    break;
                  case "00a0":
                    str += "\\_";
                    break;
                  case "2028":
                    str += "\\L";
                    break;
                  case "2029":
                    str += "\\P";
                    break;
                  default:
                    if (code.substr(0, 2) === "00")
                      str += "\\x" + code.substr(2);
                    else
                      str += json2.substr(i, 6);
                }
                i += 5;
                start = i + 1;
              }
              break;
            case "n":
              if (implicitKey || json2[i + 2] === '"' || json2.length < minMultiLineLength) {
                i += 1;
              } else {
                str += json2.slice(start, i) + "\n\n";
                while (json2[i + 2] === "\\" && json2[i + 3] === "n" && json2[i + 4] !== '"') {
                  str += "\n";
                  i += 2;
                }
                str += indent;
                if (json2[i + 2] === " ")
                  str += "\\";
                i += 1;
                start = i + 1;
              }
              break;
            default:
              i += 1;
          }
      }
      str = start ? str + json2.slice(start) : json2;
      return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_QUOTED, getFoldOptions(ctx, false));
    }
    function singleQuotedString(value, ctx) {
      if (ctx.options.singleQuote === false || ctx.implicitKey && value.includes("\n") || /[ \t]\n|\n[ \t]/.test(value))
        return doubleQuotedString(value, ctx);
      const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
      const res = "'" + value.replace(/'/g, "''").replace(/\n+/g, `$&
${indent}`) + "'";
      return ctx.implicitKey ? res : foldFlowLines.foldFlowLines(res, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
    }
    function quotedString(value, ctx) {
      const { singleQuote } = ctx.options;
      let qs;
      if (singleQuote === false)
        qs = doubleQuotedString;
      else {
        const hasDouble = value.includes('"');
        const hasSingle = value.includes("'");
        if (hasDouble && !hasSingle)
          qs = singleQuotedString;
        else if (hasSingle && !hasDouble)
          qs = doubleQuotedString;
        else
          qs = singleQuote ? singleQuotedString : doubleQuotedString;
      }
      return qs(value, ctx);
    }
    var blockEndNewlines;
    try {
      blockEndNewlines = new RegExp("(^|(?<!\n))\n+(?!\n|$)", "g");
    } catch {
      blockEndNewlines = /\n+(?!\n|$)/g;
    }
    function blockString({ comment, type, value }, ctx, onComment, onChompKeep) {
      const { blockQuote, commentString, lineWidth } = ctx.options;
      if (!blockQuote || /\n[\t ]+$/.test(value)) {
        return quotedString(value, ctx);
      }
      const indent = ctx.indent || (ctx.forceBlockIndent || containsDocumentMarker(value) ? "  " : "");
      const literal = blockQuote === "literal" ? true : blockQuote === "folded" || type === Scalar.Scalar.BLOCK_FOLDED ? false : type === Scalar.Scalar.BLOCK_LITERAL ? true : !lineLengthOverLimit(value, lineWidth, indent.length);
      if (!value)
        return literal ? "|\n" : ">\n";
      let chomp;
      let endStart;
      for (endStart = value.length; endStart > 0; --endStart) {
        const ch = value[endStart - 1];
        if (ch !== "\n" && ch !== "	" && ch !== " ")
          break;
      }
      let end = value.substring(endStart);
      const endNlPos = end.indexOf("\n");
      if (endNlPos === -1) {
        chomp = "-";
      } else if (value === end || endNlPos !== end.length - 1) {
        chomp = "+";
        if (onChompKeep)
          onChompKeep();
      } else {
        chomp = "";
      }
      if (end) {
        value = value.slice(0, -end.length);
        if (end[end.length - 1] === "\n")
          end = end.slice(0, -1);
        end = end.replace(blockEndNewlines, `$&${indent}`);
      }
      let startWithSpace = false;
      let startEnd;
      let startNlPos = -1;
      for (startEnd = 0; startEnd < value.length; ++startEnd) {
        const ch = value[startEnd];
        if (ch === " ")
          startWithSpace = true;
        else if (ch === "\n")
          startNlPos = startEnd;
        else
          break;
      }
      let start = value.substring(0, startNlPos < startEnd ? startNlPos + 1 : startEnd);
      if (start) {
        value = value.substring(start.length);
        start = start.replace(/\n+/g, `$&${indent}`);
      }
      const indentSize = indent ? "2" : "1";
      let header = (startWithSpace ? indentSize : "") + chomp;
      if (comment) {
        header += " " + commentString(comment.replace(/ ?[\r\n]+/g, " "));
        if (onComment)
          onComment();
      }
      if (!literal) {
        const foldedValue = value.replace(/\n+/g, "\n$&").replace(/(?:^|\n)([\t ].*)(?:([\n\t ]*)\n(?![\n\t ]))?/g, "$1$2").replace(/\n+/g, `$&${indent}`);
        let literalFallback = false;
        const foldOptions = getFoldOptions(ctx, true);
        if (blockQuote !== "folded" && type !== Scalar.Scalar.BLOCK_FOLDED) {
          foldOptions.onOverflow = () => {
            literalFallback = true;
          };
        }
        const body = foldFlowLines.foldFlowLines(`${start}${foldedValue}${end}`, indent, foldFlowLines.FOLD_BLOCK, foldOptions);
        if (!literalFallback)
          return `>${header}
${indent}${body}`;
      }
      value = value.replace(/\n+/g, `$&${indent}`);
      return `|${header}
${indent}${start}${value}${end}`;
    }
    function plainString(item, ctx, onComment, onChompKeep) {
      const { type, value } = item;
      const { actualString, implicitKey, indent, indentStep, inFlow } = ctx;
      if (implicitKey && value.includes("\n") || inFlow && /[[\]{},]/.test(value)) {
        return quotedString(value, ctx);
      }
      if (/^[\n\t ,[\]{}#&*!|>'"%@`]|^[?-]$|^[?-][ \t]|[\n:][ \t]|[ \t]\n|[\n\t ]#|[\n\t :]$/.test(value)) {
        return implicitKey || inFlow || !value.includes("\n") ? quotedString(value, ctx) : blockString(item, ctx, onComment, onChompKeep);
      }
      if (!implicitKey && !inFlow && type !== Scalar.Scalar.PLAIN && value.includes("\n")) {
        return blockString(item, ctx, onComment, onChompKeep);
      }
      if (containsDocumentMarker(value)) {
        if (indent === "") {
          ctx.forceBlockIndent = true;
          return blockString(item, ctx, onComment, onChompKeep);
        } else if (implicitKey && indent === indentStep) {
          return quotedString(value, ctx);
        }
      }
      const str = value.replace(/\n+/g, `$&
${indent}`);
      if (actualString) {
        const test = (tag) => tag.default && tag.tag !== "tag:yaml.org,2002:str" && tag.test?.test(str);
        const { compat, tags } = ctx.doc.schema;
        if (tags.some(test) || compat?.some(test))
          return quotedString(value, ctx);
      }
      return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
    }
    function stringifyString(item, ctx, onComment, onChompKeep) {
      const { implicitKey, inFlow } = ctx;
      const ss = typeof item.value === "string" ? item : Object.assign({}, item, { value: String(item.value) });
      let { type } = item;
      if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
        if (/[\x00-\x08\x0b-\x1f\x7f-\x9f\u{D800}-\u{DFFF}]/u.test(ss.value))
          type = Scalar.Scalar.QUOTE_DOUBLE;
      }
      const _stringify = (_type) => {
        switch (_type) {
          case Scalar.Scalar.BLOCK_FOLDED:
          case Scalar.Scalar.BLOCK_LITERAL:
            return implicitKey || inFlow ? quotedString(ss.value, ctx) : blockString(ss, ctx, onComment, onChompKeep);
          case Scalar.Scalar.QUOTE_DOUBLE:
            return doubleQuotedString(ss.value, ctx);
          case Scalar.Scalar.QUOTE_SINGLE:
            return singleQuotedString(ss.value, ctx);
          case Scalar.Scalar.PLAIN:
            return plainString(ss, ctx, onComment, onChompKeep);
          default:
            return null;
        }
      };
      let res = _stringify(type);
      if (res === null) {
        const { defaultKeyType, defaultStringType } = ctx.options;
        const t = implicitKey && defaultKeyType || defaultStringType;
        res = _stringify(t);
        if (res === null)
          throw new Error(`Unsupported default string type ${t}`);
      }
      return res;
    }
    exports.stringifyString = stringifyString;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringify.js
var require_stringify = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringify.js"(exports) {
    "use strict";
    var anchors = require_anchors();
    var identity = require_identity();
    var stringifyComment = require_stringifyComment();
    var stringifyString = require_stringifyString();
    function createStringifyContext(doc, options) {
      const opt2 = Object.assign({
        blockQuote: true,
        commentString: stringifyComment.stringifyComment,
        defaultKeyType: null,
        defaultStringType: "PLAIN",
        directives: null,
        doubleQuotedAsJSON: false,
        doubleQuotedMinMultiLineLength: 40,
        falseStr: "false",
        flowCollectionPadding: true,
        indentSeq: true,
        lineWidth: 80,
        minContentWidth: 20,
        nullStr: "null",
        simpleKeys: false,
        singleQuote: null,
        trailingComma: false,
        trueStr: "true",
        verifyAliasOrder: true
      }, doc.schema.toStringOptions, options);
      let inFlow;
      switch (opt2.collectionStyle) {
        case "block":
          inFlow = false;
          break;
        case "flow":
          inFlow = true;
          break;
        default:
          inFlow = null;
      }
      return {
        anchors: /* @__PURE__ */ new Set(),
        doc,
        flowCollectionPadding: opt2.flowCollectionPadding ? " " : "",
        indent: "",
        indentStep: typeof opt2.indent === "number" ? " ".repeat(opt2.indent) : "  ",
        inFlow,
        options: opt2
      };
    }
    function getTagObject(tags, item) {
      if (item.tag) {
        const match = tags.filter((t) => t.tag === item.tag);
        if (match.length > 0)
          return match.find((t) => t.format === item.format) ?? match[0];
      }
      let tagObj = void 0;
      let obj;
      if (identity.isScalar(item)) {
        obj = item.value;
        let match = tags.filter((t) => t.identify?.(obj));
        if (match.length > 1) {
          const testMatch = match.filter((t) => t.test);
          if (testMatch.length > 0)
            match = testMatch;
        }
        tagObj = match.find((t) => t.format === item.format) ?? match.find((t) => !t.format);
      } else {
        obj = item;
        tagObj = tags.find((t) => t.nodeClass && obj instanceof t.nodeClass);
      }
      if (!tagObj) {
        const name = obj?.constructor?.name ?? (obj === null ? "null" : typeof obj);
        throw new Error(`Tag not resolved for ${name} value`);
      }
      return tagObj;
    }
    function stringifyProps(node, tagObj, { anchors: anchors$1, doc }) {
      if (!doc.directives)
        return "";
      const props = [];
      const anchor = (identity.isScalar(node) || identity.isCollection(node)) && node.anchor;
      if (anchor && anchors.anchorIsValid(anchor)) {
        anchors$1.add(anchor);
        props.push(`&${anchor}`);
      }
      const tag = node.tag ?? (tagObj.default ? null : tagObj.tag);
      if (tag)
        props.push(doc.directives.tagString(tag));
      return props.join(" ");
    }
    function stringify(item, ctx, onComment, onChompKeep) {
      if (identity.isPair(item))
        return item.toString(ctx, onComment, onChompKeep);
      if (identity.isAlias(item)) {
        if (ctx.doc.directives)
          return item.toString(ctx);
        if (ctx.resolvedAliases?.has(item)) {
          throw new TypeError(`Cannot stringify circular structure without alias nodes`);
        } else {
          if (ctx.resolvedAliases)
            ctx.resolvedAliases.add(item);
          else
            ctx.resolvedAliases = /* @__PURE__ */ new Set([item]);
          item = item.resolve(ctx.doc);
        }
      }
      let tagObj = void 0;
      const node = identity.isNode(item) ? item : ctx.doc.createNode(item, { onTagObj: (o) => tagObj = o });
      tagObj ?? (tagObj = getTagObject(ctx.doc.schema.tags, node));
      const props = stringifyProps(node, tagObj, ctx);
      if (props.length > 0)
        ctx.indentAtStart = (ctx.indentAtStart ?? 0) + props.length + 1;
      const str = typeof tagObj.stringify === "function" ? tagObj.stringify(node, ctx, onComment, onChompKeep) : identity.isScalar(node) ? stringifyString.stringifyString(node, ctx, onComment, onChompKeep) : node.toString(ctx, onComment, onChompKeep);
      if (!props)
        return str;
      return identity.isScalar(node) || str[0] === "{" || str[0] === "[" ? `${props} ${str}` : `${props}
${ctx.indent}${str}`;
    }
    exports.createStringifyContext = createStringifyContext;
    exports.stringify = stringify;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyPair.js
var require_stringifyPair = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyPair.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyPair({ key, value }, ctx, onComment, onChompKeep) {
      const { allNullValues, doc, indent, indentStep, options: { commentString, indentSeq, simpleKeys } } = ctx;
      let keyComment = identity.isNode(key) && key.comment || null;
      if (simpleKeys) {
        if (keyComment) {
          throw new Error("With simple keys, key nodes cannot have comments");
        }
        if (identity.isCollection(key) || !identity.isNode(key) && typeof key === "object") {
          const msg = "With simple keys, collection cannot be used as a key value";
          throw new Error(msg);
        }
      }
      let explicitKey = !simpleKeys && (!key || keyComment && value == null && !ctx.inFlow || identity.isCollection(key) || (identity.isScalar(key) ? key.type === Scalar.Scalar.BLOCK_FOLDED || key.type === Scalar.Scalar.BLOCK_LITERAL : typeof key === "object"));
      ctx = Object.assign({}, ctx, {
        allNullValues: false,
        implicitKey: !explicitKey && (simpleKeys || !allNullValues),
        indent: indent + indentStep
      });
      let keyCommentDone = false;
      let chompKeep = false;
      let str = stringify.stringify(key, ctx, () => keyCommentDone = true, () => chompKeep = true);
      if (!explicitKey && !ctx.inFlow && str.length > 1024) {
        if (simpleKeys)
          throw new Error("With simple keys, single line scalar must not span more than 1024 characters");
        explicitKey = true;
      }
      if (ctx.inFlow) {
        if (allNullValues || value == null) {
          if (keyCommentDone && onComment)
            onComment();
          return str === "" ? "?" : explicitKey ? `? ${str}` : str;
        }
      } else if (allNullValues && !simpleKeys || value == null && explicitKey) {
        str = `? ${str}`;
        if (keyComment && !keyCommentDone) {
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
        } else if (chompKeep && onChompKeep)
          onChompKeep();
        return str;
      }
      if (keyCommentDone)
        keyComment = null;
      if (explicitKey) {
        if (keyComment)
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
        str = `? ${str}
${indent}:`;
      } else {
        str = `${str}:`;
        if (keyComment)
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
      }
      let vsb, vcb, valueComment;
      if (identity.isNode(value)) {
        vsb = !!value.spaceBefore;
        vcb = value.commentBefore;
        valueComment = value.comment;
      } else {
        vsb = false;
        vcb = null;
        valueComment = null;
        if (value && typeof value === "object")
          value = doc.createNode(value);
      }
      ctx.implicitKey = false;
      if (!explicitKey && !keyComment && identity.isScalar(value))
        ctx.indentAtStart = str.length + 1;
      chompKeep = false;
      if (!indentSeq && indentStep.length >= 2 && !ctx.inFlow && !explicitKey && identity.isSeq(value) && !value.flow && !value.tag && !value.anchor) {
        ctx.indent = ctx.indent.substring(2);
      }
      let valueCommentDone = false;
      const valueStr = stringify.stringify(value, ctx, () => valueCommentDone = true, () => chompKeep = true);
      let ws = " ";
      if (keyComment || vsb || vcb) {
        ws = vsb ? "\n" : "";
        if (vcb) {
          const cs = commentString(vcb);
          ws += `
${stringifyComment.indentComment(cs, ctx.indent)}`;
        }
        if (valueStr === "" && !ctx.inFlow) {
          if (ws === "\n" && valueComment)
            ws = "\n\n";
        } else {
          ws += `
${ctx.indent}`;
        }
      } else if (!explicitKey && identity.isCollection(value)) {
        const vs0 = valueStr[0];
        const nl0 = valueStr.indexOf("\n");
        const hasNewline = nl0 !== -1;
        const flow = ctx.inFlow ?? value.flow ?? value.items.length === 0;
        if (hasNewline || !flow) {
          let hasPropsLine = false;
          if (hasNewline && (vs0 === "&" || vs0 === "!")) {
            let sp0 = valueStr.indexOf(" ");
            if (vs0 === "&" && sp0 !== -1 && sp0 < nl0 && valueStr[sp0 + 1] === "!") {
              sp0 = valueStr.indexOf(" ", sp0 + 1);
            }
            if (sp0 === -1 || nl0 < sp0)
              hasPropsLine = true;
          }
          if (!hasPropsLine)
            ws = `
${ctx.indent}`;
        }
      } else if (valueStr === "" || valueStr[0] === "\n") {
        ws = "";
      }
      str += ws + valueStr;
      if (ctx.inFlow) {
        if (valueCommentDone && onComment)
          onComment();
      } else if (valueComment && !valueCommentDone) {
        str += stringifyComment.lineComment(str, ctx.indent, commentString(valueComment));
      } else if (chompKeep && onChompKeep) {
        onChompKeep();
      }
      return str;
    }
    exports.stringifyPair = stringifyPair;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/log.js
var require_log = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/log.js"(exports) {
    "use strict";
    var node_process = __require("process");
    function debug(logLevel, ...messages) {
      if (logLevel === "debug")
        console.log(...messages);
    }
    function warn(logLevel, warning) {
      if (logLevel === "debug" || logLevel === "warn") {
        if (typeof node_process.emitWarning === "function")
          node_process.emitWarning(warning);
        else
          console.warn(warning);
      }
    }
    exports.debug = debug;
    exports.warn = warn;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/merge.js
var require_merge = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/merge.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var MERGE_KEY = "<<";
    var merge = {
      identify: (value) => value === MERGE_KEY || typeof value === "symbol" && value.description === MERGE_KEY,
      default: "key",
      tag: "tag:yaml.org,2002:merge",
      test: /^<<$/,
      resolve: () => Object.assign(new Scalar.Scalar(Symbol(MERGE_KEY)), {
        addToJSMap: addMergeToJSMap
      }),
      stringify: () => MERGE_KEY
    };
    var isMergeKey = (ctx, key) => (merge.identify(key) || identity.isScalar(key) && (!key.type || key.type === Scalar.Scalar.PLAIN) && merge.identify(key.value)) && ctx?.doc.schema.tags.some((tag) => tag.tag === merge.tag && tag.default);
    function addMergeToJSMap(ctx, map, value) {
      const source = resolveAliasValue(ctx, value);
      if (identity.isSeq(source))
        for (const it of source.items)
          mergeValue(ctx, map, it);
      else if (Array.isArray(source))
        for (const it of source)
          mergeValue(ctx, map, it);
      else
        mergeValue(ctx, map, source);
    }
    function mergeValue(ctx, map, value) {
      const source = resolveAliasValue(ctx, value);
      if (!identity.isMap(source))
        throw new Error("Merge sources must be maps or map aliases");
      const srcMap = source.toJSON(null, ctx, Map);
      for (const [key, value2] of srcMap) {
        if (map instanceof Map) {
          if (!map.has(key))
            map.set(key, value2);
        } else if (map instanceof Set) {
          map.add(key);
        } else if (!Object.prototype.hasOwnProperty.call(map, key)) {
          Object.defineProperty(map, key, {
            value: value2,
            writable: true,
            enumerable: true,
            configurable: true
          });
        }
      }
      return map;
    }
    function resolveAliasValue(ctx, value) {
      return ctx && identity.isAlias(value) ? value.resolve(ctx.doc, ctx) : value;
    }
    exports.addMergeToJSMap = addMergeToJSMap;
    exports.isMergeKey = isMergeKey;
    exports.merge = merge;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/addPairToJSMap.js
var require_addPairToJSMap = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/addPairToJSMap.js"(exports) {
    "use strict";
    var log = require_log();
    var merge = require_merge();
    var stringify = require_stringify();
    var identity = require_identity();
    var toJS = require_toJS();
    function addPairToJSMap(ctx, map, { key, value }) {
      if (identity.isNode(key) && key.addToJSMap)
        key.addToJSMap(ctx, map, value);
      else if (merge.isMergeKey(ctx, key))
        merge.addMergeToJSMap(ctx, map, value);
      else {
        const jsKey = toJS.toJS(key, "", ctx);
        if (map instanceof Map) {
          map.set(jsKey, toJS.toJS(value, jsKey, ctx));
        } else if (map instanceof Set) {
          map.add(jsKey);
        } else {
          const stringKey = stringifyKey(key, jsKey, ctx);
          const jsValue = toJS.toJS(value, stringKey, ctx);
          if (stringKey in map)
            Object.defineProperty(map, stringKey, {
              value: jsValue,
              writable: true,
              enumerable: true,
              configurable: true
            });
          else
            map[stringKey] = jsValue;
        }
      }
      return map;
    }
    function stringifyKey(key, jsKey, ctx) {
      if (jsKey === null)
        return "";
      if (typeof jsKey !== "object")
        return String(jsKey);
      if (identity.isNode(key) && ctx?.doc) {
        const strCtx = stringify.createStringifyContext(ctx.doc, {});
        strCtx.anchors = /* @__PURE__ */ new Set();
        for (const node of ctx.anchors.keys())
          strCtx.anchors.add(node.anchor);
        strCtx.inFlow = true;
        strCtx.inStringifyKey = true;
        const strKey = key.toString(strCtx);
        if (!ctx.mapKeyWarned) {
          let jsonStr = JSON.stringify(strKey);
          if (jsonStr.length > 40)
            jsonStr = jsonStr.substring(0, 36) + '..."';
          log.warn(ctx.doc.options.logLevel, `Keys with collection values will be stringified due to JS Object restrictions: ${jsonStr}. Set mapAsMap: true to use object keys.`);
          ctx.mapKeyWarned = true;
        }
        return strKey;
      }
      return JSON.stringify(jsKey);
    }
    exports.addPairToJSMap = addPairToJSMap;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/Pair.js
var require_Pair = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/Pair.js"(exports) {
    "use strict";
    var createNode = require_createNode();
    var stringifyPair = require_stringifyPair();
    var addPairToJSMap = require_addPairToJSMap();
    var identity = require_identity();
    function createPair(key, value, ctx) {
      const k = createNode.createNode(key, void 0, ctx);
      const v = createNode.createNode(value, void 0, ctx);
      return new Pair(k, v);
    }
    var Pair = class _Pair {
      constructor(key, value = null) {
        Object.defineProperty(this, identity.NODE_TYPE, { value: identity.PAIR });
        this.key = key;
        this.value = value;
      }
      clone(schema) {
        let { key, value } = this;
        if (identity.isNode(key))
          key = key.clone(schema);
        if (identity.isNode(value))
          value = value.clone(schema);
        return new _Pair(key, value);
      }
      toJSON(_, ctx) {
        const pair = ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
        return addPairToJSMap.addPairToJSMap(ctx, pair, this);
      }
      toString(ctx, onComment, onChompKeep) {
        return ctx?.doc ? stringifyPair.stringifyPair(this, ctx, onComment, onChompKeep) : JSON.stringify(this);
      }
    };
    exports.Pair = Pair;
    exports.createPair = createPair;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyCollection.js
var require_stringifyCollection = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyCollection.js"(exports) {
    "use strict";
    var identity = require_identity();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyCollection(collection, ctx, options) {
      const flow = ctx.inFlow ?? collection.flow;
      const stringify2 = flow ? stringifyFlowCollection : stringifyBlockCollection;
      return stringify2(collection, ctx, options);
    }
    function stringifyBlockCollection({ comment, items }, ctx, { blockItemPrefix, flowChars, itemIndent, onChompKeep, onComment }) {
      const { indent, options: { commentString } } = ctx;
      const itemCtx = Object.assign({}, ctx, { indent: itemIndent, type: null });
      let chompKeep = false;
      const lines = [];
      for (let i = 0; i < items.length; ++i) {
        const item = items[i];
        let comment2 = null;
        if (identity.isNode(item)) {
          if (!chompKeep && item.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, item.commentBefore, chompKeep);
          if (item.comment)
            comment2 = item.comment;
        } else if (identity.isPair(item)) {
          const ik = identity.isNode(item.key) ? item.key : null;
          if (ik) {
            if (!chompKeep && ik.spaceBefore)
              lines.push("");
            addCommentBefore(ctx, lines, ik.commentBefore, chompKeep);
          }
        }
        chompKeep = false;
        let str2 = stringify.stringify(item, itemCtx, () => comment2 = null, () => chompKeep = true);
        if (comment2)
          str2 += stringifyComment.lineComment(str2, itemIndent, commentString(comment2));
        if (chompKeep && comment2)
          chompKeep = false;
        lines.push(blockItemPrefix + str2);
      }
      let str;
      if (lines.length === 0) {
        str = flowChars.start + flowChars.end;
      } else {
        str = lines[0];
        for (let i = 1; i < lines.length; ++i) {
          const line = lines[i];
          str += line ? `
${indent}${line}` : "\n";
        }
      }
      if (comment) {
        str += "\n" + stringifyComment.indentComment(commentString(comment), indent);
        if (onComment)
          onComment();
      } else if (chompKeep && onChompKeep)
        onChompKeep();
      return str;
    }
    function stringifyFlowCollection({ items }, ctx, { flowChars, itemIndent }) {
      const { indent, indentStep, flowCollectionPadding: fcPadding, options: { commentString } } = ctx;
      itemIndent += indentStep;
      const itemCtx = Object.assign({}, ctx, {
        indent: itemIndent,
        inFlow: true,
        type: null
      });
      let reqNewline = false;
      let linesAtValue = 0;
      const lines = [];
      for (let i = 0; i < items.length; ++i) {
        const item = items[i];
        let comment = null;
        if (identity.isNode(item)) {
          if (item.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, item.commentBefore, false);
          if (item.comment)
            comment = item.comment;
        } else if (identity.isPair(item)) {
          const ik = identity.isNode(item.key) ? item.key : null;
          if (ik) {
            if (ik.spaceBefore)
              lines.push("");
            addCommentBefore(ctx, lines, ik.commentBefore, false);
            if (ik.comment)
              reqNewline = true;
          }
          const iv = identity.isNode(item.value) ? item.value : null;
          if (iv) {
            if (iv.comment)
              comment = iv.comment;
            if (iv.commentBefore)
              reqNewline = true;
          } else if (item.value == null && ik?.comment) {
            comment = ik.comment;
          }
        }
        if (comment)
          reqNewline = true;
        let str = stringify.stringify(item, itemCtx, () => comment = null);
        reqNewline || (reqNewline = lines.length > linesAtValue || str.includes("\n"));
        if (i < items.length - 1) {
          str += ",";
        } else if (ctx.options.trailingComma) {
          if (ctx.options.lineWidth > 0) {
            reqNewline || (reqNewline = lines.reduce((sum, line) => sum + line.length + 2, 2) + (str.length + 2) > ctx.options.lineWidth);
          }
          if (reqNewline) {
            str += ",";
          }
        }
        if (comment)
          str += stringifyComment.lineComment(str, itemIndent, commentString(comment));
        lines.push(str);
        linesAtValue = lines.length;
      }
      const { start, end } = flowChars;
      if (lines.length === 0) {
        return start + end;
      } else {
        if (!reqNewline) {
          const len = lines.reduce((sum, line) => sum + line.length + 2, 2);
          reqNewline = ctx.options.lineWidth > 0 && len > ctx.options.lineWidth;
        }
        if (reqNewline) {
          let str = start;
          for (const line of lines)
            str += line ? `
${indentStep}${indent}${line}` : "\n";
          return `${str}
${indent}${end}`;
        } else {
          return `${start}${fcPadding}${lines.join(" ")}${fcPadding}${end}`;
        }
      }
    }
    function addCommentBefore({ indent, options: { commentString } }, lines, comment, chompKeep) {
      if (comment && chompKeep)
        comment = comment.replace(/^\n+/, "");
      if (comment) {
        const ic = stringifyComment.indentComment(commentString(comment), indent);
        lines.push(ic.trimStart());
      }
    }
    exports.stringifyCollection = stringifyCollection;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/YAMLMap.js
var require_YAMLMap = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/YAMLMap.js"(exports) {
    "use strict";
    var stringifyCollection = require_stringifyCollection();
    var addPairToJSMap = require_addPairToJSMap();
    var Collection = require_Collection();
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    function findPair(items, key) {
      const k = identity.isScalar(key) ? key.value : key;
      for (const it of items) {
        if (identity.isPair(it)) {
          if (it.key === key || it.key === k)
            return it;
          if (identity.isScalar(it.key) && it.key.value === k)
            return it;
        }
      }
      return void 0;
    }
    var YAMLMap = class extends Collection.Collection {
      static get tagName() {
        return "tag:yaml.org,2002:map";
      }
      constructor(schema) {
        super(identity.MAP, schema);
        this.items = [];
      }
      /**
       * A generic collection parsing method that can be extended
       * to other node classes that inherit from YAMLMap
       */
      static from(schema, obj, ctx) {
        const { keepUndefined, replacer } = ctx;
        const map = new this(schema);
        const add = (key, value) => {
          if (typeof replacer === "function")
            value = replacer.call(obj, key, value);
          else if (Array.isArray(replacer) && !replacer.includes(key))
            return;
          if (value !== void 0 || keepUndefined)
            map.items.push(Pair.createPair(key, value, ctx));
        };
        if (obj instanceof Map) {
          for (const [key, value] of obj)
            add(key, value);
        } else if (obj && typeof obj === "object") {
          for (const key of Object.keys(obj))
            add(key, obj[key]);
        }
        if (typeof schema.sortMapEntries === "function") {
          map.items.sort(schema.sortMapEntries);
        }
        return map;
      }
      /**
       * Adds a value to the collection.
       *
       * @param overwrite - If not set `true`, using a key that is already in the
       *   collection will throw. Otherwise, overwrites the previous value.
       */
      add(pair, overwrite) {
        let _pair;
        if (identity.isPair(pair))
          _pair = pair;
        else if (!pair || typeof pair !== "object" || !("key" in pair)) {
          _pair = new Pair.Pair(pair, pair?.value);
        } else
          _pair = new Pair.Pair(pair.key, pair.value);
        const prev = findPair(this.items, _pair.key);
        const sortEntries = this.schema?.sortMapEntries;
        if (prev) {
          if (!overwrite)
            throw new Error(`Key ${_pair.key} already set`);
          if (identity.isScalar(prev.value) && Scalar.isScalarValue(_pair.value))
            prev.value.value = _pair.value;
          else
            prev.value = _pair.value;
        } else if (sortEntries) {
          const i = this.items.findIndex((item) => sortEntries(_pair, item) < 0);
          if (i === -1)
            this.items.push(_pair);
          else
            this.items.splice(i, 0, _pair);
        } else {
          this.items.push(_pair);
        }
      }
      delete(key) {
        const it = findPair(this.items, key);
        if (!it)
          return false;
        const del = this.items.splice(this.items.indexOf(it), 1);
        return del.length > 0;
      }
      get(key, keepScalar) {
        const it = findPair(this.items, key);
        const node = it?.value;
        return (!keepScalar && identity.isScalar(node) ? node.value : node) ?? void 0;
      }
      has(key) {
        return !!findPair(this.items, key);
      }
      set(key, value) {
        this.add(new Pair.Pair(key, value), true);
      }
      /**
       * @param ctx - Conversion context, originally set in Document#toJS()
       * @param {Class} Type - If set, forces the returned collection type
       * @returns Instance of Type, Map, or Object
       */
      toJSON(_, ctx, Type) {
        const map = Type ? new Type() : ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
        if (ctx?.onCreate)
          ctx.onCreate(map);
        for (const item of this.items)
          addPairToJSMap.addPairToJSMap(ctx, map, item);
        return map;
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        for (const item of this.items) {
          if (!identity.isPair(item))
            throw new Error(`Map items must all be pairs; found ${JSON.stringify(item)} instead`);
        }
        if (!ctx.allNullValues && this.hasAllNullValues(false))
          ctx = Object.assign({}, ctx, { allNullValues: true });
        return stringifyCollection.stringifyCollection(this, ctx, {
          blockItemPrefix: "",
          flowChars: { start: "{", end: "}" },
          itemIndent: ctx.indent || "",
          onChompKeep,
          onComment
        });
      }
    };
    exports.YAMLMap = YAMLMap;
    exports.findPair = findPair;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/common/map.js
var require_map = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/common/map.js"(exports) {
    "use strict";
    var identity = require_identity();
    var YAMLMap = require_YAMLMap();
    var map = {
      collection: "map",
      default: true,
      nodeClass: YAMLMap.YAMLMap,
      tag: "tag:yaml.org,2002:map",
      resolve(map2, onError) {
        if (!identity.isMap(map2))
          onError("Expected a mapping for this tag");
        return map2;
      },
      createNode: (schema, obj, ctx) => YAMLMap.YAMLMap.from(schema, obj, ctx)
    };
    exports.map = map;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/YAMLSeq.js
var require_YAMLSeq = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/YAMLSeq.js"(exports) {
    "use strict";
    var createNode = require_createNode();
    var stringifyCollection = require_stringifyCollection();
    var Collection = require_Collection();
    var identity = require_identity();
    var Scalar = require_Scalar();
    var toJS = require_toJS();
    var YAMLSeq = class extends Collection.Collection {
      static get tagName() {
        return "tag:yaml.org,2002:seq";
      }
      constructor(schema) {
        super(identity.SEQ, schema);
        this.items = [];
      }
      add(value) {
        this.items.push(value);
      }
      /**
       * Removes a value from the collection.
       *
       * `key` must contain a representation of an integer for this to succeed.
       * It may be wrapped in a `Scalar`.
       *
       * @returns `true` if the item was found and removed.
       */
      delete(key) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          return false;
        const del = this.items.splice(idx, 1);
        return del.length > 0;
      }
      get(key, keepScalar) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          return void 0;
        const it = this.items[idx];
        return !keepScalar && identity.isScalar(it) ? it.value : it;
      }
      /**
       * Checks if the collection includes a value with the key `key`.
       *
       * `key` must contain a representation of an integer for this to succeed.
       * It may be wrapped in a `Scalar`.
       */
      has(key) {
        const idx = asItemIndex(key);
        return typeof idx === "number" && idx < this.items.length;
      }
      /**
       * Sets a value in this collection. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       *
       * If `key` does not contain a representation of an integer, this will throw.
       * It may be wrapped in a `Scalar`.
       */
      set(key, value) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          throw new Error(`Expected a valid index, not ${key}.`);
        const prev = this.items[idx];
        if (identity.isScalar(prev) && Scalar.isScalarValue(value))
          prev.value = value;
        else
          this.items[idx] = value;
      }
      toJSON(_, ctx) {
        const seq = [];
        if (ctx?.onCreate)
          ctx.onCreate(seq);
        let i = 0;
        for (const item of this.items)
          seq.push(toJS.toJS(item, String(i++), ctx));
        return seq;
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        return stringifyCollection.stringifyCollection(this, ctx, {
          blockItemPrefix: "- ",
          flowChars: { start: "[", end: "]" },
          itemIndent: (ctx.indent || "") + "  ",
          onChompKeep,
          onComment
        });
      }
      static from(schema, obj, ctx) {
        const { replacer } = ctx;
        const seq = new this(schema);
        if (obj && Symbol.iterator in Object(obj)) {
          let i = 0;
          for (let it of obj) {
            if (typeof replacer === "function") {
              const key = obj instanceof Set ? it : String(i++);
              it = replacer.call(obj, key, it);
            }
            seq.items.push(createNode.createNode(it, void 0, ctx));
          }
        }
        return seq;
      }
    };
    function asItemIndex(key) {
      let idx = identity.isScalar(key) ? key.value : key;
      if (idx && typeof idx === "string")
        idx = Number(idx);
      return typeof idx === "number" && Number.isInteger(idx) && idx >= 0 ? idx : null;
    }
    exports.YAMLSeq = YAMLSeq;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/common/seq.js
var require_seq = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/common/seq.js"(exports) {
    "use strict";
    var identity = require_identity();
    var YAMLSeq = require_YAMLSeq();
    var seq = {
      collection: "seq",
      default: true,
      nodeClass: YAMLSeq.YAMLSeq,
      tag: "tag:yaml.org,2002:seq",
      resolve(seq2, onError) {
        if (!identity.isSeq(seq2))
          onError("Expected a sequence for this tag");
        return seq2;
      },
      createNode: (schema, obj, ctx) => YAMLSeq.YAMLSeq.from(schema, obj, ctx)
    };
    exports.seq = seq;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/common/string.js
var require_string = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/common/string.js"(exports) {
    "use strict";
    var stringifyString = require_stringifyString();
    var string = {
      identify: (value) => typeof value === "string",
      default: true,
      tag: "tag:yaml.org,2002:str",
      resolve: (str) => str,
      stringify(item, ctx, onComment, onChompKeep) {
        ctx = Object.assign({ actualString: true }, ctx);
        return stringifyString.stringifyString(item, ctx, onComment, onChompKeep);
      }
    };
    exports.string = string;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/common/null.js
var require_null = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/common/null.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var nullTag = {
      identify: (value) => value == null,
      createNode: () => new Scalar.Scalar(null),
      default: true,
      tag: "tag:yaml.org,2002:null",
      test: /^(?:~|[Nn]ull|NULL)?$/,
      resolve: () => new Scalar.Scalar(null),
      stringify: ({ source }, ctx) => typeof source === "string" && nullTag.test.test(source) ? source : ctx.options.nullStr
    };
    exports.nullTag = nullTag;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/core/bool.js
var require_bool = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/core/bool.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var boolTag = {
      identify: (value) => typeof value === "boolean",
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:[Tt]rue|TRUE|[Ff]alse|FALSE)$/,
      resolve: (str) => new Scalar.Scalar(str[0] === "t" || str[0] === "T"),
      stringify({ source, value }, ctx) {
        if (source && boolTag.test.test(source)) {
          const sv = source[0] === "t" || source[0] === "T";
          if (value === sv)
            return source;
        }
        return value ? ctx.options.trueStr : ctx.options.falseStr;
      }
    };
    exports.boolTag = boolTag;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyNumber.js
var require_stringifyNumber = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyNumber.js"(exports) {
    "use strict";
    function stringifyNumber({ format, minFractionDigits, tag, value }) {
      if (typeof value === "bigint")
        return String(value);
      const num = typeof value === "number" ? value : Number(value);
      if (!isFinite(num))
        return isNaN(num) ? ".nan" : num < 0 ? "-.inf" : ".inf";
      let n = Object.is(value, -0) ? "-0" : JSON.stringify(value);
      if (!format && minFractionDigits && (!tag || tag === "tag:yaml.org,2002:float") && /^-?\d/.test(n) && !n.includes("e")) {
        let i = n.indexOf(".");
        if (i < 0) {
          i = n.length;
          n += ".";
        }
        let d = minFractionDigits - (n.length - i - 1);
        while (d-- > 0)
          n += "0";
      }
      return n;
    }
    exports.stringifyNumber = stringifyNumber;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/core/float.js
var require_float = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/core/float.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var stringifyNumber = require_stringifyNumber();
    var floatNaN = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
      resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
      stringify: stringifyNumber.stringifyNumber
    };
    var floatExp = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "EXP",
      test: /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+$/,
      resolve: (str) => parseFloat(str),
      stringify(node) {
        const num = Number(node.value);
        return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
      }
    };
    var float = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^[-+]?(?:\.[0-9]+|[0-9]+\.[0-9]*)$/,
      resolve(str) {
        const node = new Scalar.Scalar(parseFloat(str));
        const dot = str.indexOf(".");
        if (dot !== -1 && str[str.length - 1] === "0")
          node.minFractionDigits = str.length - dot - 1;
        return node;
      },
      stringify: stringifyNumber.stringifyNumber
    };
    exports.float = float;
    exports.floatExp = floatExp;
    exports.floatNaN = floatNaN;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/core/int.js
var require_int = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/core/int.js"(exports) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
    var intResolve = (str, offset, radix, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str.substring(offset), radix);
    function intStringify(node, radix, prefix) {
      const { value } = node;
      if (intIdentify(value) && value >= 0)
        return prefix + value.toString(radix);
      return stringifyNumber.stringifyNumber(node);
    }
    var intOct = {
      identify: (value) => intIdentify(value) && value >= 0,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "OCT",
      test: /^0o[0-7]+$/,
      resolve: (str, _onError, opt2) => intResolve(str, 2, 8, opt2),
      stringify: (node) => intStringify(node, 8, "0o")
    };
    var int = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^[-+]?[0-9]+$/,
      resolve: (str, _onError, opt2) => intResolve(str, 0, 10, opt2),
      stringify: stringifyNumber.stringifyNumber
    };
    var intHex = {
      identify: (value) => intIdentify(value) && value >= 0,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "HEX",
      test: /^0x[0-9a-fA-F]+$/,
      resolve: (str, _onError, opt2) => intResolve(str, 2, 16, opt2),
      stringify: (node) => intStringify(node, 16, "0x")
    };
    exports.int = int;
    exports.intHex = intHex;
    exports.intOct = intOct;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/core/schema.js
var require_schema = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/core/schema.js"(exports) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var bool = require_bool();
    var float = require_float();
    var int = require_int();
    var schema = [
      map.map,
      seq.seq,
      string.string,
      _null.nullTag,
      bool.boolTag,
      int.intOct,
      int.int,
      int.intHex,
      float.floatNaN,
      float.floatExp,
      float.float
    ];
    exports.schema = schema;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/json/schema.js
var require_schema2 = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/json/schema.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var map = require_map();
    var seq = require_seq();
    function intIdentify(value) {
      return typeof value === "bigint" || Number.isInteger(value);
    }
    var stringifyJSON = ({ value }) => JSON.stringify(value);
    var jsonScalars = [
      {
        identify: (value) => typeof value === "string",
        default: true,
        tag: "tag:yaml.org,2002:str",
        resolve: (str) => str,
        stringify: stringifyJSON
      },
      {
        identify: (value) => value == null,
        createNode: () => new Scalar.Scalar(null),
        default: true,
        tag: "tag:yaml.org,2002:null",
        test: /^null$/,
        resolve: () => null,
        stringify: stringifyJSON
      },
      {
        identify: (value) => typeof value === "boolean",
        default: true,
        tag: "tag:yaml.org,2002:bool",
        test: /^true$|^false$/,
        resolve: (str) => str === "true",
        stringify: stringifyJSON
      },
      {
        identify: intIdentify,
        default: true,
        tag: "tag:yaml.org,2002:int",
        test: /^-?(?:0|[1-9][0-9]*)$/,
        resolve: (str, _onError, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str, 10),
        stringify: ({ value }) => intIdentify(value) ? value.toString() : JSON.stringify(value)
      },
      {
        identify: (value) => typeof value === "number",
        default: true,
        tag: "tag:yaml.org,2002:float",
        test: /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$/,
        resolve: (str) => parseFloat(str),
        stringify: stringifyJSON
      }
    ];
    var jsonError = {
      default: true,
      tag: "",
      test: /^/,
      resolve(str, onError) {
        onError(`Unresolved plain scalar ${JSON.stringify(str)}`);
        return str;
      }
    };
    var schema = [map.map, seq.seq].concat(jsonScalars, jsonError);
    exports.schema = schema;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/binary.js
var require_binary = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/binary.js"(exports) {
    "use strict";
    var node_buffer = __require("buffer");
    var Scalar = require_Scalar();
    var stringifyString = require_stringifyString();
    var binary = {
      identify: (value) => value instanceof Uint8Array,
      // Buffer inherits from Uint8Array
      default: false,
      tag: "tag:yaml.org,2002:binary",
      /**
       * Returns a Buffer in node and an Uint8Array in browsers
       *
       * To use the resulting buffer as an image, you'll want to do something like:
       *
       *   const blob = new Blob([buffer], { type: 'image/jpeg' })
       *   document.querySelector('#photo').src = URL.createObjectURL(blob)
       */
      resolve(src, onError) {
        if (typeof node_buffer.Buffer === "function") {
          return node_buffer.Buffer.from(src, "base64");
        } else if (typeof atob === "function") {
          const str = atob(src.replace(/[\n\r]/g, ""));
          const buffer = new Uint8Array(str.length);
          for (let i = 0; i < str.length; ++i)
            buffer[i] = str.charCodeAt(i);
          return buffer;
        } else {
          onError("This environment does not support reading binary tags; either Buffer or atob is required");
          return src;
        }
      },
      stringify({ comment, type, value }, ctx, onComment, onChompKeep) {
        if (!value)
          return "";
        const buf = value;
        let str;
        if (typeof node_buffer.Buffer === "function") {
          str = buf instanceof node_buffer.Buffer ? buf.toString("base64") : node_buffer.Buffer.from(buf.buffer).toString("base64");
        } else if (typeof btoa === "function") {
          let s = "";
          for (let i = 0; i < buf.length; ++i)
            s += String.fromCharCode(buf[i]);
          str = btoa(s);
        } else {
          throw new Error("This environment does not support writing binary tags; either Buffer or btoa is required");
        }
        type ?? (type = Scalar.Scalar.BLOCK_LITERAL);
        if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
          const lineWidth = Math.max(ctx.options.lineWidth - ctx.indent.length, ctx.options.minContentWidth);
          const n = Math.ceil(str.length / lineWidth);
          const lines = new Array(n);
          for (let i = 0, o = 0; i < n; ++i, o += lineWidth) {
            lines[i] = str.substr(o, lineWidth);
          }
          str = lines.join(type === Scalar.Scalar.BLOCK_LITERAL ? "\n" : " ");
        }
        return stringifyString.stringifyString({ comment, type, value: str }, ctx, onComment, onChompKeep);
      }
    };
    exports.binary = binary;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/pairs.js
var require_pairs = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/pairs.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    var YAMLSeq = require_YAMLSeq();
    function resolvePairs(seq, onError) {
      if (identity.isSeq(seq)) {
        for (let i = 0; i < seq.items.length; ++i) {
          let item = seq.items[i];
          if (identity.isPair(item))
            continue;
          else if (identity.isMap(item)) {
            if (item.items.length > 1)
              onError("Each pair must have its own sequence indicator");
            const pair = item.items[0] || new Pair.Pair(new Scalar.Scalar(null));
            if (item.commentBefore)
              pair.key.commentBefore = pair.key.commentBefore ? `${item.commentBefore}
${pair.key.commentBefore}` : item.commentBefore;
            if (item.comment) {
              const cn = pair.value ?? pair.key;
              cn.comment = cn.comment ? `${item.comment}
${cn.comment}` : item.comment;
            }
            item = pair;
          }
          seq.items[i] = identity.isPair(item) ? item : new Pair.Pair(item);
        }
      } else
        onError("Expected a sequence for this tag");
      return seq;
    }
    function createPairs(schema, iterable, ctx) {
      const { replacer } = ctx;
      const pairs2 = new YAMLSeq.YAMLSeq(schema);
      pairs2.tag = "tag:yaml.org,2002:pairs";
      let i = 0;
      if (iterable && Symbol.iterator in Object(iterable))
        for (let it of iterable) {
          if (typeof replacer === "function")
            it = replacer.call(iterable, String(i++), it);
          let key, value;
          if (Array.isArray(it)) {
            if (it.length === 2) {
              key = it[0];
              value = it[1];
            } else
              throw new TypeError(`Expected [key, value] tuple: ${it}`);
          } else if (it && it instanceof Object) {
            const keys = Object.keys(it);
            if (keys.length === 1) {
              key = keys[0];
              value = it[key];
            } else {
              throw new TypeError(`Expected tuple with one key, not ${keys.length} keys`);
            }
          } else {
            key = it;
          }
          pairs2.items.push(Pair.createPair(key, value, ctx));
        }
      return pairs2;
    }
    var pairs = {
      collection: "seq",
      default: false,
      tag: "tag:yaml.org,2002:pairs",
      resolve: resolvePairs,
      createNode: createPairs
    };
    exports.createPairs = createPairs;
    exports.pairs = pairs;
    exports.resolvePairs = resolvePairs;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/omap.js
var require_omap = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/omap.js"(exports) {
    "use strict";
    var identity = require_identity();
    var toJS = require_toJS();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var pairs = require_pairs();
    var YAMLOMap = class _YAMLOMap extends YAMLSeq.YAMLSeq {
      constructor() {
        super();
        this.add = YAMLMap.YAMLMap.prototype.add.bind(this);
        this.delete = YAMLMap.YAMLMap.prototype.delete.bind(this);
        this.get = YAMLMap.YAMLMap.prototype.get.bind(this);
        this.has = YAMLMap.YAMLMap.prototype.has.bind(this);
        this.set = YAMLMap.YAMLMap.prototype.set.bind(this);
        this.tag = _YAMLOMap.tag;
      }
      /**
       * If `ctx` is given, the return type is actually `Map<unknown, unknown>`,
       * but TypeScript won't allow widening the signature of a child method.
       */
      toJSON(_, ctx) {
        if (!ctx)
          return super.toJSON(_);
        const map = /* @__PURE__ */ new Map();
        if (ctx?.onCreate)
          ctx.onCreate(map);
        for (const pair of this.items) {
          let key, value;
          if (identity.isPair(pair)) {
            key = toJS.toJS(pair.key, "", ctx);
            value = toJS.toJS(pair.value, key, ctx);
          } else {
            key = toJS.toJS(pair, "", ctx);
          }
          if (map.has(key))
            throw new Error("Ordered maps must not include duplicate keys");
          map.set(key, value);
        }
        return map;
      }
      static from(schema, iterable, ctx) {
        const pairs$1 = pairs.createPairs(schema, iterable, ctx);
        const omap2 = new this();
        omap2.items = pairs$1.items;
        return omap2;
      }
    };
    YAMLOMap.tag = "tag:yaml.org,2002:omap";
    var omap = {
      collection: "seq",
      identify: (value) => value instanceof Map,
      nodeClass: YAMLOMap,
      default: false,
      tag: "tag:yaml.org,2002:omap",
      resolve(seq, onError) {
        const pairs$1 = pairs.resolvePairs(seq, onError);
        const seenKeys = [];
        for (const { key } of pairs$1.items) {
          if (identity.isScalar(key)) {
            if (seenKeys.includes(key.value)) {
              onError(`Ordered maps must not include duplicate keys: ${key.value}`);
            } else {
              seenKeys.push(key.value);
            }
          }
        }
        return Object.assign(new YAMLOMap(), pairs$1);
      },
      createNode: (schema, iterable, ctx) => YAMLOMap.from(schema, iterable, ctx)
    };
    exports.YAMLOMap = YAMLOMap;
    exports.omap = omap;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/bool.js
var require_bool2 = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/bool.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    function boolStringify({ value, source }, ctx) {
      const boolObj = value ? trueTag : falseTag;
      if (source && boolObj.test.test(source))
        return source;
      return value ? ctx.options.trueStr : ctx.options.falseStr;
    }
    var trueTag = {
      identify: (value) => value === true,
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:Y|y|[Yy]es|YES|[Tt]rue|TRUE|[Oo]n|ON)$/,
      resolve: () => new Scalar.Scalar(true),
      stringify: boolStringify
    };
    var falseTag = {
      identify: (value) => value === false,
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:N|n|[Nn]o|NO|[Ff]alse|FALSE|[Oo]ff|OFF)$/,
      resolve: () => new Scalar.Scalar(false),
      stringify: boolStringify
    };
    exports.falseTag = falseTag;
    exports.trueTag = trueTag;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/float.js
var require_float2 = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/float.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var stringifyNumber = require_stringifyNumber();
    var floatNaN = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
      resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
      stringify: stringifyNumber.stringifyNumber
    };
    var floatExp = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "EXP",
      test: /^[-+]?(?:[0-9][0-9_]*)?(?:\.[0-9_]*)?[eE][-+]?[0-9]+$/,
      resolve: (str) => parseFloat(str.replace(/_/g, "")),
      stringify(node) {
        const num = Number(node.value);
        return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
      }
    };
    var float = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^[-+]?(?:[0-9][0-9_]*)?\.[0-9_]*$/,
      resolve(str) {
        const node = new Scalar.Scalar(parseFloat(str.replace(/_/g, "")));
        const dot = str.indexOf(".");
        if (dot !== -1) {
          const f = str.substring(dot + 1).replace(/_/g, "");
          if (f[f.length - 1] === "0")
            node.minFractionDigits = f.length;
        }
        return node;
      },
      stringify: stringifyNumber.stringifyNumber
    };
    exports.float = float;
    exports.floatExp = floatExp;
    exports.floatNaN = floatNaN;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/int.js
var require_int2 = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/int.js"(exports) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
    function intResolve(str, offset, radix, { intAsBigInt }) {
      const sign = str[0];
      if (sign === "-" || sign === "+")
        offset += 1;
      str = str.substring(offset).replace(/_/g, "");
      if (intAsBigInt) {
        switch (radix) {
          case 2:
            str = `0b${str}`;
            break;
          case 8:
            str = `0o${str}`;
            break;
          case 16:
            str = `0x${str}`;
            break;
        }
        const n2 = BigInt(str);
        return sign === "-" ? BigInt(-1) * n2 : n2;
      }
      const n = parseInt(str, radix);
      return sign === "-" ? -1 * n : n;
    }
    function intStringify(node, radix, prefix) {
      const { value } = node;
      if (intIdentify(value)) {
        const str = value.toString(radix);
        return value < 0 ? "-" + prefix + str.substr(1) : prefix + str;
      }
      return stringifyNumber.stringifyNumber(node);
    }
    var intBin = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "BIN",
      test: /^[-+]?0b[0-1_]+$/,
      resolve: (str, _onError, opt2) => intResolve(str, 2, 2, opt2),
      stringify: (node) => intStringify(node, 2, "0b")
    };
    var intOct = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "OCT",
      test: /^[-+]?0[0-7_]+$/,
      resolve: (str, _onError, opt2) => intResolve(str, 1, 8, opt2),
      stringify: (node) => intStringify(node, 8, "0")
    };
    var int = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^[-+]?[0-9][0-9_]*$/,
      resolve: (str, _onError, opt2) => intResolve(str, 0, 10, opt2),
      stringify: stringifyNumber.stringifyNumber
    };
    var intHex = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "HEX",
      test: /^[-+]?0x[0-9a-fA-F_]+$/,
      resolve: (str, _onError, opt2) => intResolve(str, 2, 16, opt2),
      stringify: (node) => intStringify(node, 16, "0x")
    };
    exports.int = int;
    exports.intBin = intBin;
    exports.intHex = intHex;
    exports.intOct = intOct;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/set.js
var require_set = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/set.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var YAMLSet = class _YAMLSet extends YAMLMap.YAMLMap {
      constructor(schema) {
        super(schema);
        this.tag = _YAMLSet.tag;
      }
      add(key) {
        let pair;
        if (identity.isPair(key))
          pair = key;
        else if (key && typeof key === "object" && "key" in key && "value" in key && key.value === null)
          pair = new Pair.Pair(key.key, null);
        else
          pair = new Pair.Pair(key, null);
        const prev = YAMLMap.findPair(this.items, pair.key);
        if (!prev)
          this.items.push(pair);
      }
      /**
       * If `keepPair` is `true`, returns the Pair matching `key`.
       * Otherwise, returns the value of that Pair's key.
       */
      get(key, keepPair) {
        const pair = YAMLMap.findPair(this.items, key);
        return !keepPair && identity.isPair(pair) ? identity.isScalar(pair.key) ? pair.key.value : pair.key : pair;
      }
      set(key, value) {
        if (typeof value !== "boolean")
          throw new Error(`Expected boolean value for set(key, value) in a YAML set, not ${typeof value}`);
        const prev = YAMLMap.findPair(this.items, key);
        if (prev && !value) {
          this.items.splice(this.items.indexOf(prev), 1);
        } else if (!prev && value) {
          this.items.push(new Pair.Pair(key));
        }
      }
      toJSON(_, ctx) {
        return super.toJSON(_, ctx, Set);
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        if (this.hasAllNullValues(true))
          return super.toString(Object.assign({}, ctx, { allNullValues: true }), onComment, onChompKeep);
        else
          throw new Error("Set items must all have null values");
      }
      static from(schema, iterable, ctx) {
        const { replacer } = ctx;
        const set2 = new this(schema);
        if (iterable && Symbol.iterator in Object(iterable))
          for (let value of iterable) {
            if (typeof replacer === "function")
              value = replacer.call(iterable, value, value);
            set2.items.push(Pair.createPair(value, null, ctx));
          }
        return set2;
      }
    };
    YAMLSet.tag = "tag:yaml.org,2002:set";
    var set = {
      collection: "map",
      identify: (value) => value instanceof Set,
      nodeClass: YAMLSet,
      default: false,
      tag: "tag:yaml.org,2002:set",
      createNode: (schema, iterable, ctx) => YAMLSet.from(schema, iterable, ctx),
      resolve(map, onError) {
        if (identity.isMap(map)) {
          if (map.hasAllNullValues(true))
            return Object.assign(new YAMLSet(), map);
          else
            onError("Set items must all have null values");
        } else
          onError("Expected a mapping for this tag");
        return map;
      }
    };
    exports.YAMLSet = YAMLSet;
    exports.set = set;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/timestamp.js
var require_timestamp = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/timestamp.js"(exports) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    function parseSexagesimal(str, asBigInt) {
      const sign = str[0];
      const parts = sign === "-" || sign === "+" ? str.substring(1) : str;
      const num = (n) => asBigInt ? BigInt(n) : Number(n);
      const res = parts.replace(/_/g, "").split(":").reduce((res2, p) => res2 * num(60) + num(p), num(0));
      return sign === "-" ? num(-1) * res : res;
    }
    function stringifySexagesimal(node) {
      let { value } = node;
      let num = (n) => n;
      if (typeof value === "bigint")
        num = (n) => BigInt(n);
      else if (isNaN(value) || !isFinite(value))
        return stringifyNumber.stringifyNumber(node);
      let sign = "";
      if (value < 0) {
        sign = "-";
        value *= num(-1);
      }
      const _60 = num(60);
      const parts = [value % _60];
      if (value < 60) {
        parts.unshift(0);
      } else {
        value = (value - parts[0]) / _60;
        parts.unshift(value % _60);
        if (value >= 60) {
          value = (value - parts[0]) / _60;
          parts.unshift(value);
        }
      }
      return sign + parts.map((n) => String(n).padStart(2, "0")).join(":").replace(/000000\d*$/, "");
    }
    var intTime = {
      identify: (value) => typeof value === "bigint" || Number.isInteger(value),
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "TIME",
      test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+$/,
      resolve: (str, _onError, { intAsBigInt }) => parseSexagesimal(str, intAsBigInt),
      stringify: stringifySexagesimal
    };
    var floatTime = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "TIME",
      test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*$/,
      resolve: (str) => parseSexagesimal(str, false),
      stringify: stringifySexagesimal
    };
    var timestamp = {
      identify: (value) => value instanceof Date,
      default: true,
      tag: "tag:yaml.org,2002:timestamp",
      // If the time zone is omitted, the timestamp is assumed to be specified in UTC. The time part
      // may be omitted altogether, resulting in a date format. In such a case, the time part is
      // assumed to be 00:00:00Z (start of day, UTC).
      test: RegExp("^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})(?:(?:t|T|[ \\t]+)([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2}(\\.[0-9]+)?)(?:[ \\t]*(Z|[-+][012]?[0-9](?::[0-9]{2})?))?)?$"),
      resolve(str) {
        const match = str.match(timestamp.test);
        if (!match)
          throw new Error("!!timestamp expects a date, starting with yyyy-mm-dd");
        const [, year, month, day, hour, minute, second] = match.map(Number);
        const millisec = match[7] ? Number((match[7] + "00").substr(1, 3)) : 0;
        let date = Date.UTC(year, month - 1, day, hour || 0, minute || 0, second || 0, millisec);
        const tz = match[8];
        if (tz && tz !== "Z") {
          let d = parseSexagesimal(tz, false);
          if (Math.abs(d) < 30)
            d *= 60;
          date -= 6e4 * d;
        }
        return new Date(date);
      },
      stringify: ({ value }) => value?.toISOString().replace(/(T00:00:00)?\.000Z$/, "") ?? ""
    };
    exports.floatTime = floatTime;
    exports.intTime = intTime;
    exports.timestamp = timestamp;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/schema.js
var require_schema3 = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/schema.js"(exports) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var binary = require_binary();
    var bool = require_bool2();
    var float = require_float2();
    var int = require_int2();
    var merge = require_merge();
    var omap = require_omap();
    var pairs = require_pairs();
    var set = require_set();
    var timestamp = require_timestamp();
    var schema = [
      map.map,
      seq.seq,
      string.string,
      _null.nullTag,
      bool.trueTag,
      bool.falseTag,
      int.intBin,
      int.intOct,
      int.int,
      int.intHex,
      float.floatNaN,
      float.floatExp,
      float.float,
      binary.binary,
      merge.merge,
      omap.omap,
      pairs.pairs,
      set.set,
      timestamp.intTime,
      timestamp.floatTime,
      timestamp.timestamp
    ];
    exports.schema = schema;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/tags.js
var require_tags = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/tags.js"(exports) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var bool = require_bool();
    var float = require_float();
    var int = require_int();
    var schema = require_schema();
    var schema$1 = require_schema2();
    var binary = require_binary();
    var merge = require_merge();
    var omap = require_omap();
    var pairs = require_pairs();
    var schema$2 = require_schema3();
    var set = require_set();
    var timestamp = require_timestamp();
    var schemas = /* @__PURE__ */ new Map([
      ["core", schema.schema],
      ["failsafe", [map.map, seq.seq, string.string]],
      ["json", schema$1.schema],
      ["yaml11", schema$2.schema],
      ["yaml-1.1", schema$2.schema]
    ]);
    var tagsByName = {
      binary: binary.binary,
      bool: bool.boolTag,
      float: float.float,
      floatExp: float.floatExp,
      floatNaN: float.floatNaN,
      floatTime: timestamp.floatTime,
      int: int.int,
      intHex: int.intHex,
      intOct: int.intOct,
      intTime: timestamp.intTime,
      map: map.map,
      merge: merge.merge,
      null: _null.nullTag,
      omap: omap.omap,
      pairs: pairs.pairs,
      seq: seq.seq,
      set: set.set,
      timestamp: timestamp.timestamp
    };
    var coreKnownTags = {
      "tag:yaml.org,2002:binary": binary.binary,
      "tag:yaml.org,2002:merge": merge.merge,
      "tag:yaml.org,2002:omap": omap.omap,
      "tag:yaml.org,2002:pairs": pairs.pairs,
      "tag:yaml.org,2002:set": set.set,
      "tag:yaml.org,2002:timestamp": timestamp.timestamp
    };
    function getTags(customTags, schemaName, addMergeTag) {
      const schemaTags = schemas.get(schemaName);
      if (schemaTags && !customTags) {
        return addMergeTag && !schemaTags.includes(merge.merge) ? schemaTags.concat(merge.merge) : schemaTags.slice();
      }
      let tags = schemaTags;
      if (!tags) {
        if (Array.isArray(customTags))
          tags = [];
        else {
          const keys = Array.from(schemas.keys()).filter((key) => key !== "yaml11").map((key) => JSON.stringify(key)).join(", ");
          throw new Error(`Unknown schema "${schemaName}"; use one of ${keys} or define customTags array`);
        }
      }
      if (Array.isArray(customTags)) {
        for (const tag of customTags)
          tags = tags.concat(tag);
      } else if (typeof customTags === "function") {
        tags = customTags(tags.slice());
      }
      if (addMergeTag)
        tags = tags.concat(merge.merge);
      return tags.reduce((tags2, tag) => {
        const tagObj = typeof tag === "string" ? tagsByName[tag] : tag;
        if (!tagObj) {
          const tagName = JSON.stringify(tag);
          const keys = Object.keys(tagsByName).map((key) => JSON.stringify(key)).join(", ");
          throw new Error(`Unknown custom tag ${tagName}; use one of ${keys}`);
        }
        if (!tags2.includes(tagObj))
          tags2.push(tagObj);
        return tags2;
      }, []);
    }
    exports.coreKnownTags = coreKnownTags;
    exports.getTags = getTags;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/Schema.js
var require_Schema = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/Schema.js"(exports) {
    "use strict";
    var identity = require_identity();
    var map = require_map();
    var seq = require_seq();
    var string = require_string();
    var tags = require_tags();
    var sortMapEntriesByKey = (a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
    var Schema = class _Schema {
      constructor({ compat, customTags, merge, resolveKnownTags, schema, sortMapEntries, toStringDefaults }) {
        this.compat = Array.isArray(compat) ? tags.getTags(compat, "compat") : compat ? tags.getTags(null, compat) : null;
        this.name = typeof schema === "string" && schema || "core";
        this.knownTags = resolveKnownTags ? tags.coreKnownTags : {};
        this.tags = tags.getTags(customTags, this.name, merge);
        this.toStringOptions = toStringDefaults ?? null;
        Object.defineProperty(this, identity.MAP, { value: map.map });
        Object.defineProperty(this, identity.SCALAR, { value: string.string });
        Object.defineProperty(this, identity.SEQ, { value: seq.seq });
        this.sortMapEntries = typeof sortMapEntries === "function" ? sortMapEntries : sortMapEntries === true ? sortMapEntriesByKey : null;
      }
      clone() {
        const copy = Object.create(_Schema.prototype, Object.getOwnPropertyDescriptors(this));
        copy.tags = this.tags.slice();
        return copy;
      }
    };
    exports.Schema = Schema;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyDocument.js
var require_stringifyDocument = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyDocument.js"(exports) {
    "use strict";
    var identity = require_identity();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyDocument(doc, options) {
      const lines = [];
      let hasDirectives = options.directives === true;
      if (options.directives !== false && doc.directives) {
        const dir = doc.directives.toString(doc);
        if (dir) {
          lines.push(dir);
          hasDirectives = true;
        } else if (doc.directives.docStart)
          hasDirectives = true;
      }
      if (hasDirectives)
        lines.push("---");
      const ctx = stringify.createStringifyContext(doc, options);
      const { commentString } = ctx.options;
      if (doc.commentBefore) {
        if (lines.length !== 1)
          lines.unshift("");
        const cs = commentString(doc.commentBefore);
        lines.unshift(stringifyComment.indentComment(cs, ""));
      }
      let chompKeep = false;
      let contentComment = null;
      if (doc.contents) {
        if (identity.isNode(doc.contents)) {
          if (doc.contents.spaceBefore && hasDirectives)
            lines.push("");
          if (doc.contents.commentBefore) {
            const cs = commentString(doc.contents.commentBefore);
            lines.push(stringifyComment.indentComment(cs, ""));
          }
          ctx.forceBlockIndent = !!doc.comment;
          contentComment = doc.contents.comment;
        }
        const onChompKeep = contentComment ? void 0 : () => chompKeep = true;
        let body = stringify.stringify(doc.contents, ctx, () => contentComment = null, onChompKeep);
        if (contentComment)
          body += stringifyComment.lineComment(body, "", commentString(contentComment));
        if ((body[0] === "|" || body[0] === ">") && lines[lines.length - 1] === "---") {
          lines[lines.length - 1] = `--- ${body}`;
        } else
          lines.push(body);
      } else {
        lines.push(stringify.stringify(doc.contents, ctx));
      }
      if (doc.directives?.docEnd) {
        if (doc.comment) {
          const cs = commentString(doc.comment);
          if (cs.includes("\n")) {
            lines.push("...");
            lines.push(stringifyComment.indentComment(cs, ""));
          } else {
            lines.push(`... ${cs}`);
          }
        } else {
          lines.push("...");
        }
      } else {
        let dc = doc.comment;
        if (dc && chompKeep)
          dc = dc.replace(/^\n+/, "");
        if (dc) {
          if ((!chompKeep || contentComment) && lines[lines.length - 1] !== "")
            lines.push("");
          lines.push(stringifyComment.indentComment(commentString(dc), ""));
        }
      }
      return lines.join("\n") + "\n";
    }
    exports.stringifyDocument = stringifyDocument;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/doc/Document.js
var require_Document = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/doc/Document.js"(exports) {
    "use strict";
    var Alias = require_Alias();
    var Collection = require_Collection();
    var identity = require_identity();
    var Pair = require_Pair();
    var toJS = require_toJS();
    var Schema = require_Schema();
    var stringifyDocument = require_stringifyDocument();
    var anchors = require_anchors();
    var applyReviver = require_applyReviver();
    var createNode = require_createNode();
    var directives = require_directives();
    var Document = class _Document {
      constructor(value, replacer, options) {
        this.commentBefore = null;
        this.comment = null;
        this.errors = [];
        this.warnings = [];
        Object.defineProperty(this, identity.NODE_TYPE, { value: identity.DOC });
        let _replacer = null;
        if (typeof replacer === "function" || Array.isArray(replacer)) {
          _replacer = replacer;
        } else if (options === void 0 && replacer) {
          options = replacer;
          replacer = void 0;
        }
        const opt2 = Object.assign({
          intAsBigInt: false,
          keepSourceTokens: false,
          logLevel: "warn",
          prettyErrors: true,
          strict: true,
          stringKeys: false,
          uniqueKeys: true,
          version: "1.2"
        }, options);
        this.options = opt2;
        let { version: version2 } = opt2;
        if (options?._directives) {
          this.directives = options._directives.atDocument();
          if (this.directives.yaml.explicit)
            version2 = this.directives.yaml.version;
        } else
          this.directives = new directives.Directives({ version: version2 });
        this.setSchema(version2, options);
        this.contents = value === void 0 ? null : this.createNode(value, _replacer, options);
      }
      /**
       * Create a deep copy of this Document and its contents.
       *
       * Custom Node values that inherit from `Object` still refer to their original instances.
       */
      clone() {
        const copy = Object.create(_Document.prototype, {
          [identity.NODE_TYPE]: { value: identity.DOC }
        });
        copy.commentBefore = this.commentBefore;
        copy.comment = this.comment;
        copy.errors = this.errors.slice();
        copy.warnings = this.warnings.slice();
        copy.options = Object.assign({}, this.options);
        if (this.directives)
          copy.directives = this.directives.clone();
        copy.schema = this.schema.clone();
        copy.contents = identity.isNode(this.contents) ? this.contents.clone(copy.schema) : this.contents;
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /** Adds a value to the document. */
      add(value) {
        if (assertCollection(this.contents))
          this.contents.add(value);
      }
      /** Adds a value to the document. */
      addIn(path2, value) {
        if (assertCollection(this.contents))
          this.contents.addIn(path2, value);
      }
      /**
       * Create a new `Alias` node, ensuring that the target `node` has the required anchor.
       *
       * If `node` already has an anchor, `name` is ignored.
       * Otherwise, the `node.anchor` value will be set to `name`,
       * or if an anchor with that name is already present in the document,
       * `name` will be used as a prefix for a new unique anchor.
       * If `name` is undefined, the generated anchor will use 'a' as a prefix.
       */
      createAlias(node, name) {
        if (!node.anchor) {
          const prev = anchors.anchorNames(this);
          node.anchor = // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          !name || prev.has(name) ? anchors.findNewAnchor(name || "a", prev) : name;
        }
        return new Alias.Alias(node.anchor);
      }
      createNode(value, replacer, options) {
        let _replacer = void 0;
        if (typeof replacer === "function") {
          value = replacer.call({ "": value }, "", value);
          _replacer = replacer;
        } else if (Array.isArray(replacer)) {
          const keyToStr = (v) => typeof v === "number" || v instanceof String || v instanceof Number;
          const asStr = replacer.filter(keyToStr).map(String);
          if (asStr.length > 0)
            replacer = replacer.concat(asStr);
          _replacer = replacer;
        } else if (options === void 0 && replacer) {
          options = replacer;
          replacer = void 0;
        }
        const { aliasDuplicateObjects, anchorPrefix, flow, keepUndefined, onTagObj, tag } = options ?? {};
        const { onAnchor, setAnchors, sourceObjects } = anchors.createNodeAnchors(
          this,
          // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          anchorPrefix || "a"
        );
        const ctx = {
          aliasDuplicateObjects: aliasDuplicateObjects ?? true,
          keepUndefined: keepUndefined ?? false,
          onAnchor,
          onTagObj,
          replacer: _replacer,
          schema: this.schema,
          sourceObjects
        };
        const node = createNode.createNode(value, tag, ctx);
        if (flow && identity.isCollection(node))
          node.flow = true;
        setAnchors();
        return node;
      }
      /**
       * Convert a key and a value into a `Pair` using the current schema,
       * recursively wrapping all values as `Scalar` or `Collection` nodes.
       */
      createPair(key, value, options = {}) {
        const k = this.createNode(key, null, options);
        const v = this.createNode(value, null, options);
        return new Pair.Pair(k, v);
      }
      /**
       * Removes a value from the document.
       * @returns `true` if the item was found and removed.
       */
      delete(key) {
        return assertCollection(this.contents) ? this.contents.delete(key) : false;
      }
      /**
       * Removes a value from the document.
       * @returns `true` if the item was found and removed.
       */
      deleteIn(path2) {
        if (Collection.isEmptyPath(path2)) {
          if (this.contents == null)
            return false;
          this.contents = null;
          return true;
        }
        return assertCollection(this.contents) ? this.contents.deleteIn(path2) : false;
      }
      /**
       * Returns item at `key`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      get(key, keepScalar) {
        return identity.isCollection(this.contents) ? this.contents.get(key, keepScalar) : void 0;
      }
      /**
       * Returns item at `path`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      getIn(path2, keepScalar) {
        if (Collection.isEmptyPath(path2))
          return !keepScalar && identity.isScalar(this.contents) ? this.contents.value : this.contents;
        return identity.isCollection(this.contents) ? this.contents.getIn(path2, keepScalar) : void 0;
      }
      /**
       * Checks if the document includes a value with the key `key`.
       */
      has(key) {
        return identity.isCollection(this.contents) ? this.contents.has(key) : false;
      }
      /**
       * Checks if the document includes a value at `path`.
       */
      hasIn(path2) {
        if (Collection.isEmptyPath(path2))
          return this.contents !== void 0;
        return identity.isCollection(this.contents) ? this.contents.hasIn(path2) : false;
      }
      /**
       * Sets a value in this document. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      set(key, value) {
        if (this.contents == null) {
          this.contents = Collection.collectionFromPath(this.schema, [key], value);
        } else if (assertCollection(this.contents)) {
          this.contents.set(key, value);
        }
      }
      /**
       * Sets a value in this document. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      setIn(path2, value) {
        if (Collection.isEmptyPath(path2)) {
          this.contents = value;
        } else if (this.contents == null) {
          this.contents = Collection.collectionFromPath(this.schema, Array.from(path2), value);
        } else if (assertCollection(this.contents)) {
          this.contents.setIn(path2, value);
        }
      }
      /**
       * Change the YAML version and schema used by the document.
       * A `null` version disables support for directives, explicit tags, anchors, and aliases.
       * It also requires the `schema` option to be given as a `Schema` instance value.
       *
       * Overrides all previously set schema options.
       */
      setSchema(version2, options = {}) {
        if (typeof version2 === "number")
          version2 = String(version2);
        let opt2;
        switch (version2) {
          case "1.1":
            if (this.directives)
              this.directives.yaml.version = "1.1";
            else
              this.directives = new directives.Directives({ version: "1.1" });
            opt2 = { resolveKnownTags: false, schema: "yaml-1.1" };
            break;
          case "1.2":
          case "next":
            if (this.directives)
              this.directives.yaml.version = version2;
            else
              this.directives = new directives.Directives({ version: version2 });
            opt2 = { resolveKnownTags: true, schema: "core" };
            break;
          case null:
            if (this.directives)
              delete this.directives;
            opt2 = null;
            break;
          default: {
            const sv = JSON.stringify(version2);
            throw new Error(`Expected '1.1', '1.2' or null as first argument, but found: ${sv}`);
          }
        }
        if (options.schema instanceof Object)
          this.schema = options.schema;
        else if (opt2)
          this.schema = new Schema.Schema(Object.assign(opt2, options));
        else
          throw new Error(`With a null YAML version, the { schema: Schema } option is required`);
      }
      // json & jsonArg are only used from toJSON()
      toJS({ json: json2, jsonArg, mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
        const ctx = {
          anchors: /* @__PURE__ */ new Map(),
          doc: this,
          keep: !json2,
          mapAsMap: mapAsMap === true,
          mapKeyWarned: false,
          maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
        };
        const res = toJS.toJS(this.contents, jsonArg ?? "", ctx);
        if (typeof onAnchor === "function")
          for (const { count, res: res2 } of ctx.anchors.values())
            onAnchor(res2, count);
        return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
      }
      /**
       * A JSON representation of the document `contents`.
       *
       * @param jsonArg Used by `JSON.stringify` to indicate the array index or
       *   property name.
       */
      toJSON(jsonArg, onAnchor) {
        return this.toJS({ json: true, jsonArg, mapAsMap: false, onAnchor });
      }
      /** A YAML representation of the document. */
      toString(options = {}) {
        if (this.errors.length > 0)
          throw new Error("Document with errors cannot be stringified");
        if ("indent" in options && (!Number.isInteger(options.indent) || Number(options.indent) <= 0)) {
          const s = JSON.stringify(options.indent);
          throw new Error(`"indent" option must be a positive integer, not ${s}`);
        }
        return stringifyDocument.stringifyDocument(this, options);
      }
    };
    function assertCollection(contents) {
      if (identity.isCollection(contents))
        return true;
      throw new Error("Expected a YAML collection as document contents");
    }
    exports.Document = Document;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/errors.js
var require_errors = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/errors.js"(exports) {
    "use strict";
    var YAMLError = class extends Error {
      constructor(name, pos, code, message) {
        super();
        this.name = name;
        this.code = code;
        this.message = message;
        this.pos = pos;
      }
    };
    var YAMLParseError = class extends YAMLError {
      constructor(pos, code, message) {
        super("YAMLParseError", pos, code, message);
      }
    };
    var YAMLWarning = class extends YAMLError {
      constructor(pos, code, message) {
        super("YAMLWarning", pos, code, message);
      }
    };
    var prettifyError = (src, lc) => (error) => {
      if (error.pos[0] === -1)
        return;
      error.linePos = error.pos.map((pos) => lc.linePos(pos));
      const { line, col } = error.linePos[0];
      error.message += ` at line ${line}, column ${col}`;
      let ci = col - 1;
      let lineStr = src.substring(lc.lineStarts[line - 1], lc.lineStarts[line]).replace(/[\n\r]+$/, "");
      if (ci >= 60 && lineStr.length > 80) {
        const trimStart = Math.min(ci - 39, lineStr.length - 79);
        lineStr = "\u2026" + lineStr.substring(trimStart);
        ci -= trimStart - 1;
      }
      if (lineStr.length > 80)
        lineStr = lineStr.substring(0, 79) + "\u2026";
      if (line > 1 && /^ *$/.test(lineStr.substring(0, ci))) {
        let prev = src.substring(lc.lineStarts[line - 2], lc.lineStarts[line - 1]);
        if (prev.length > 80)
          prev = prev.substring(0, 79) + "\u2026\n";
        lineStr = prev + lineStr;
      }
      if (/[^ ]/.test(lineStr)) {
        let count = 1;
        const end = error.linePos[1];
        if (end?.line === line && end.col > col) {
          count = Math.max(1, Math.min(end.col - col, 80 - ci));
        }
        const pointer = " ".repeat(ci) + "^".repeat(count);
        error.message += `:

${lineStr}
${pointer}
`;
      }
    };
    exports.YAMLError = YAMLError;
    exports.YAMLParseError = YAMLParseError;
    exports.YAMLWarning = YAMLWarning;
    exports.prettifyError = prettifyError;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-props.js
var require_resolve_props = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-props.js"(exports) {
    "use strict";
    function resolveProps(tokens, { flow, indicator, next, offset, onError, parentIndent, startOnNewline }) {
      let spaceBefore = false;
      let atNewline = startOnNewline;
      let hasSpace = startOnNewline;
      let comment = "";
      let commentSep = "";
      let hasNewline = false;
      let reqSpace = false;
      let tab = null;
      let anchor = null;
      let tag = null;
      let newlineAfterProp = null;
      let comma = null;
      let found = null;
      let start = null;
      for (const token of tokens) {
        if (reqSpace) {
          if (token.type !== "space" && token.type !== "newline" && token.type !== "comma")
            onError(token.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
          reqSpace = false;
        }
        if (tab) {
          if (atNewline && token.type !== "comment" && token.type !== "newline") {
            onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
          }
          tab = null;
        }
        switch (token.type) {
          case "space":
            if (!flow && (indicator !== "doc-start" || next?.type !== "flow-collection") && token.source.includes("	")) {
              tab = token;
            }
            hasSpace = true;
            break;
          case "comment": {
            if (!hasSpace)
              onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
            const cb = token.source.substring(1) || " ";
            if (!comment)
              comment = cb;
            else
              comment += commentSep + cb;
            commentSep = "";
            atNewline = false;
            break;
          }
          case "newline":
            if (atNewline) {
              if (comment)
                comment += token.source;
              else if (!found || indicator !== "seq-item-ind")
                spaceBefore = true;
            } else
              commentSep += token.source;
            atNewline = true;
            hasNewline = true;
            if (anchor || tag)
              newlineAfterProp = token;
            hasSpace = true;
            break;
          case "anchor":
            if (anchor)
              onError(token, "MULTIPLE_ANCHORS", "A node can have at most one anchor");
            if (token.source.endsWith(":"))
              onError(token.offset + token.source.length - 1, "BAD_ALIAS", "Anchor ending in : is ambiguous", true);
            anchor = token;
            start ?? (start = token.offset);
            atNewline = false;
            hasSpace = false;
            reqSpace = true;
            break;
          case "tag": {
            if (tag)
              onError(token, "MULTIPLE_TAGS", "A node can have at most one tag");
            tag = token;
            start ?? (start = token.offset);
            atNewline = false;
            hasSpace = false;
            reqSpace = true;
            break;
          }
          case indicator:
            if (anchor || tag)
              onError(token, "BAD_PROP_ORDER", `Anchors and tags must be after the ${token.source} indicator`);
            if (found)
              onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.source} in ${flow ?? "collection"}`);
            found = token;
            atNewline = indicator === "seq-item-ind" || indicator === "explicit-key-ind";
            hasSpace = false;
            break;
          case "comma":
            if (flow) {
              if (comma)
                onError(token, "UNEXPECTED_TOKEN", `Unexpected , in ${flow}`);
              comma = token;
              atNewline = false;
              hasSpace = false;
              break;
            }
          // else fallthrough
          default:
            onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.type} token`);
            atNewline = false;
            hasSpace = false;
        }
      }
      const last = tokens[tokens.length - 1];
      const end = last ? last.offset + last.source.length : offset;
      if (reqSpace && next && next.type !== "space" && next.type !== "newline" && next.type !== "comma" && (next.type !== "scalar" || next.source !== "")) {
        onError(next.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
      }
      if (tab && (atNewline && tab.indent <= parentIndent || next?.type === "block-map" || next?.type === "block-seq"))
        onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
      return {
        comma,
        found,
        spaceBefore,
        comment,
        hasNewline,
        anchor,
        tag,
        newlineAfterProp,
        end,
        start: start ?? end
      };
    }
    exports.resolveProps = resolveProps;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/util-contains-newline.js
var require_util_contains_newline = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/util-contains-newline.js"(exports) {
    "use strict";
    function containsNewline(key) {
      if (!key)
        return null;
      switch (key.type) {
        case "alias":
        case "scalar":
        case "double-quoted-scalar":
        case "single-quoted-scalar":
          if (key.source.includes("\n"))
            return true;
          if (key.end) {
            for (const st of key.end)
              if (st.type === "newline")
                return true;
          }
          return false;
        case "flow-collection":
          for (const it of key.items) {
            for (const st of it.start)
              if (st.type === "newline")
                return true;
            if (it.sep) {
              for (const st of it.sep)
                if (st.type === "newline")
                  return true;
            }
            if (containsNewline(it.key) || containsNewline(it.value))
              return true;
          }
          return false;
        default:
          return true;
      }
    }
    exports.containsNewline = containsNewline;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/util-flow-indent-check.js
var require_util_flow_indent_check = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/util-flow-indent-check.js"(exports) {
    "use strict";
    var utilContainsNewline = require_util_contains_newline();
    function flowIndentCheck(indent, fc, onError) {
      if (fc?.type === "flow-collection") {
        const end = fc.end[0];
        if (end.indent === indent && (end.source === "]" || end.source === "}") && utilContainsNewline.containsNewline(fc)) {
          const msg = "Flow end indicator should be more indented than parent";
          onError(end, "BAD_INDENT", msg, true);
        }
      }
    }
    exports.flowIndentCheck = flowIndentCheck;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/util-map-includes.js
var require_util_map_includes = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/util-map-includes.js"(exports) {
    "use strict";
    var identity = require_identity();
    function mapIncludes(ctx, items, search) {
      const { uniqueKeys } = ctx.options;
      if (uniqueKeys === false)
        return false;
      const isEqual = typeof uniqueKeys === "function" ? uniqueKeys : (a, b) => a === b || identity.isScalar(a) && identity.isScalar(b) && a.value === b.value;
      return items.some((pair) => isEqual(pair.key, search));
    }
    exports.mapIncludes = mapIncludes;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-block-map.js
var require_resolve_block_map = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-block-map.js"(exports) {
    "use strict";
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var resolveProps = require_resolve_props();
    var utilContainsNewline = require_util_contains_newline();
    var utilFlowIndentCheck = require_util_flow_indent_check();
    var utilMapIncludes = require_util_map_includes();
    var startColMsg = "All mapping items must start at the same column";
    function resolveBlockMap({ composeNode, composeEmptyNode }, ctx, bm, onError, tag) {
      const NodeClass = tag?.nodeClass ?? YAMLMap.YAMLMap;
      const map = new NodeClass(ctx.schema);
      if (ctx.atRoot)
        ctx.atRoot = false;
      let offset = bm.offset;
      let commentEnd = null;
      for (const collItem of bm.items) {
        const { start, key, sep: sep3, value } = collItem;
        const keyProps = resolveProps.resolveProps(start, {
          indicator: "explicit-key-ind",
          next: key ?? sep3?.[0],
          offset,
          onError,
          parentIndent: bm.indent,
          startOnNewline: true
        });
        const implicitKey = !keyProps.found;
        if (implicitKey) {
          if (key) {
            if (key.type === "block-seq")
              onError(offset, "BLOCK_AS_IMPLICIT_KEY", "A block sequence may not be used as an implicit map key");
            else if ("indent" in key && key.indent !== bm.indent)
              onError(offset, "BAD_INDENT", startColMsg);
          }
          if (!keyProps.anchor && !keyProps.tag && !sep3) {
            commentEnd = keyProps.end;
            if (keyProps.comment) {
              if (map.comment)
                map.comment += "\n" + keyProps.comment;
              else
                map.comment = keyProps.comment;
            }
            continue;
          }
          if (keyProps.newlineAfterProp || utilContainsNewline.containsNewline(key)) {
            onError(key ?? start[start.length - 1], "MULTILINE_IMPLICIT_KEY", "Implicit keys need to be on a single line");
          }
        } else if (keyProps.found?.indent !== bm.indent) {
          onError(offset, "BAD_INDENT", startColMsg);
        }
        ctx.atKey = true;
        const keyStart = keyProps.end;
        const keyNode = key ? composeNode(ctx, key, keyProps, onError) : composeEmptyNode(ctx, keyStart, start, null, keyProps, onError);
        if (ctx.schema.compat)
          utilFlowIndentCheck.flowIndentCheck(bm.indent, key, onError);
        ctx.atKey = false;
        if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
          onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
        const valueProps = resolveProps.resolveProps(sep3 ?? [], {
          indicator: "map-value-ind",
          next: value,
          offset: keyNode.range[2],
          onError,
          parentIndent: bm.indent,
          startOnNewline: !key || key.type === "block-scalar"
        });
        offset = valueProps.end;
        if (valueProps.found) {
          if (implicitKey) {
            if (value?.type === "block-map" && !valueProps.hasNewline)
              onError(offset, "BLOCK_AS_IMPLICIT_KEY", "Nested mappings are not allowed in compact mappings");
            if (ctx.options.strict && keyProps.start < valueProps.found.offset - 1024)
              onError(keyNode.range, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit block mapping key");
          }
          const valueNode = value ? composeNode(ctx, value, valueProps, onError) : composeEmptyNode(ctx, offset, sep3, null, valueProps, onError);
          if (ctx.schema.compat)
            utilFlowIndentCheck.flowIndentCheck(bm.indent, value, onError);
          offset = valueNode.range[2];
          const pair = new Pair.Pair(keyNode, valueNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          map.items.push(pair);
        } else {
          if (implicitKey)
            onError(keyNode.range, "MISSING_CHAR", "Implicit map keys need to be followed by map values");
          if (valueProps.comment) {
            if (keyNode.comment)
              keyNode.comment += "\n" + valueProps.comment;
            else
              keyNode.comment = valueProps.comment;
          }
          const pair = new Pair.Pair(keyNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          map.items.push(pair);
        }
      }
      if (commentEnd && commentEnd < offset)
        onError(commentEnd, "IMPOSSIBLE", "Map comment with trailing content");
      map.range = [bm.offset, offset, commentEnd ?? offset];
      return map;
    }
    exports.resolveBlockMap = resolveBlockMap;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-block-seq.js
var require_resolve_block_seq = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-block-seq.js"(exports) {
    "use strict";
    var YAMLSeq = require_YAMLSeq();
    var resolveProps = require_resolve_props();
    var utilFlowIndentCheck = require_util_flow_indent_check();
    function resolveBlockSeq({ composeNode, composeEmptyNode }, ctx, bs, onError, tag) {
      const NodeClass = tag?.nodeClass ?? YAMLSeq.YAMLSeq;
      const seq = new NodeClass(ctx.schema);
      if (ctx.atRoot)
        ctx.atRoot = false;
      if (ctx.atKey)
        ctx.atKey = false;
      let offset = bs.offset;
      let commentEnd = null;
      for (const { start, value } of bs.items) {
        const props = resolveProps.resolveProps(start, {
          indicator: "seq-item-ind",
          next: value,
          offset,
          onError,
          parentIndent: bs.indent,
          startOnNewline: true
        });
        if (!props.found) {
          if (props.anchor || props.tag || value) {
            if (value?.type === "block-seq")
              onError(props.end, "BAD_INDENT", "All sequence items must start at the same column");
            else
              onError(offset, "MISSING_CHAR", "Sequence item without - indicator");
          } else {
            commentEnd = props.end;
            if (props.comment)
              seq.comment = props.comment;
            continue;
          }
        }
        const node = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, start, null, props, onError);
        if (ctx.schema.compat)
          utilFlowIndentCheck.flowIndentCheck(bs.indent, value, onError);
        offset = node.range[2];
        seq.items.push(node);
      }
      seq.range = [bs.offset, offset, commentEnd ?? offset];
      return seq;
    }
    exports.resolveBlockSeq = resolveBlockSeq;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-end.js
var require_resolve_end = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-end.js"(exports) {
    "use strict";
    function resolveEnd(end, offset, reqSpace, onError) {
      let comment = "";
      if (end) {
        let hasSpace = false;
        let sep3 = "";
        for (const token of end) {
          const { source, type } = token;
          switch (type) {
            case "space":
              hasSpace = true;
              break;
            case "comment": {
              if (reqSpace && !hasSpace)
                onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
              const cb = source.substring(1) || " ";
              if (!comment)
                comment = cb;
              else
                comment += sep3 + cb;
              sep3 = "";
              break;
            }
            case "newline":
              if (comment)
                sep3 += source;
              hasSpace = true;
              break;
            default:
              onError(token, "UNEXPECTED_TOKEN", `Unexpected ${type} at node end`);
          }
          offset += source.length;
        }
      }
      return { comment, offset };
    }
    exports.resolveEnd = resolveEnd;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-flow-collection.js
var require_resolve_flow_collection = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-flow-collection.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var resolveEnd = require_resolve_end();
    var resolveProps = require_resolve_props();
    var utilContainsNewline = require_util_contains_newline();
    var utilMapIncludes = require_util_map_includes();
    var blockMsg = "Block collections are not allowed within flow collections";
    var isBlock = (token) => token && (token.type === "block-map" || token.type === "block-seq");
    function resolveFlowCollection({ composeNode, composeEmptyNode }, ctx, fc, onError, tag) {
      const isMap2 = fc.start.source === "{";
      const fcName = isMap2 ? "flow map" : "flow sequence";
      const NodeClass = tag?.nodeClass ?? (isMap2 ? YAMLMap.YAMLMap : YAMLSeq.YAMLSeq);
      const coll = new NodeClass(ctx.schema);
      coll.flow = true;
      const atRoot = ctx.atRoot;
      if (atRoot)
        ctx.atRoot = false;
      if (ctx.atKey)
        ctx.atKey = false;
      let offset = fc.offset + fc.start.source.length;
      for (let i = 0; i < fc.items.length; ++i) {
        const collItem = fc.items[i];
        const { start, key, sep: sep3, value } = collItem;
        const props = resolveProps.resolveProps(start, {
          flow: fcName,
          indicator: "explicit-key-ind",
          next: key ?? sep3?.[0],
          offset,
          onError,
          parentIndent: fc.indent,
          startOnNewline: false
        });
        if (!props.found) {
          if (!props.anchor && !props.tag && !sep3 && !value) {
            if (i === 0 && props.comma)
              onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
            else if (i < fc.items.length - 1)
              onError(props.start, "UNEXPECTED_TOKEN", `Unexpected empty item in ${fcName}`);
            if (props.comment) {
              if (coll.comment)
                coll.comment += "\n" + props.comment;
              else
                coll.comment = props.comment;
            }
            offset = props.end;
            continue;
          }
          if (!isMap2 && ctx.options.strict && utilContainsNewline.containsNewline(key))
            onError(
              key,
              // checked by containsNewline()
              "MULTILINE_IMPLICIT_KEY",
              "Implicit keys of flow sequence pairs need to be on a single line"
            );
        }
        if (i === 0) {
          if (props.comma)
            onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
        } else {
          if (!props.comma)
            onError(props.start, "MISSING_CHAR", `Missing , between ${fcName} items`);
          if (props.comment) {
            let prevItemComment = "";
            loop: for (const st of start) {
              switch (st.type) {
                case "comma":
                case "space":
                  break;
                case "comment":
                  prevItemComment = st.source.substring(1);
                  break loop;
                default:
                  break loop;
              }
            }
            if (prevItemComment) {
              let prev = coll.items[coll.items.length - 1];
              if (identity.isPair(prev))
                prev = prev.value ?? prev.key;
              if (prev.comment)
                prev.comment += "\n" + prevItemComment;
              else
                prev.comment = prevItemComment;
              props.comment = props.comment.substring(prevItemComment.length + 1);
            }
          }
        }
        if (!isMap2 && !sep3 && !props.found) {
          const valueNode = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, sep3, null, props, onError);
          coll.items.push(valueNode);
          offset = valueNode.range[2];
          if (isBlock(value))
            onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
        } else {
          ctx.atKey = true;
          const keyStart = props.end;
          const keyNode = key ? composeNode(ctx, key, props, onError) : composeEmptyNode(ctx, keyStart, start, null, props, onError);
          if (isBlock(key))
            onError(keyNode.range, "BLOCK_IN_FLOW", blockMsg);
          ctx.atKey = false;
          const valueProps = resolveProps.resolveProps(sep3 ?? [], {
            flow: fcName,
            indicator: "map-value-ind",
            next: value,
            offset: keyNode.range[2],
            onError,
            parentIndent: fc.indent,
            startOnNewline: false
          });
          if (valueProps.found) {
            if (!isMap2 && !props.found && ctx.options.strict) {
              if (sep3)
                for (const st of sep3) {
                  if (st === valueProps.found)
                    break;
                  if (st.type === "newline") {
                    onError(st, "MULTILINE_IMPLICIT_KEY", "Implicit keys of flow sequence pairs need to be on a single line");
                    break;
                  }
                }
              if (props.start < valueProps.found.offset - 1024)
                onError(valueProps.found, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit flow sequence key");
            }
          } else if (value) {
            if ("source" in value && value.source?.[0] === ":")
              onError(value, "MISSING_CHAR", `Missing space after : in ${fcName}`);
            else
              onError(valueProps.start, "MISSING_CHAR", `Missing , or : between ${fcName} items`);
          }
          const valueNode = value ? composeNode(ctx, value, valueProps, onError) : valueProps.found ? composeEmptyNode(ctx, valueProps.end, sep3, null, valueProps, onError) : null;
          if (valueNode) {
            if (isBlock(value))
              onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
          } else if (valueProps.comment) {
            if (keyNode.comment)
              keyNode.comment += "\n" + valueProps.comment;
            else
              keyNode.comment = valueProps.comment;
          }
          const pair = new Pair.Pair(keyNode, valueNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          if (isMap2) {
            const map = coll;
            if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
              onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
            map.items.push(pair);
          } else {
            const map = new YAMLMap.YAMLMap(ctx.schema);
            map.flow = true;
            map.items.push(pair);
            const endRange = (valueNode ?? keyNode).range;
            map.range = [keyNode.range[0], endRange[1], endRange[2]];
            coll.items.push(map);
          }
          offset = valueNode ? valueNode.range[2] : valueProps.end;
        }
      }
      const expectedEnd = isMap2 ? "}" : "]";
      const [ce, ...ee] = fc.end;
      let cePos = offset;
      if (ce?.source === expectedEnd)
        cePos = ce.offset + ce.source.length;
      else {
        const name = fcName[0].toUpperCase() + fcName.substring(1);
        const msg = atRoot ? `${name} must end with a ${expectedEnd}` : `${name} in block collection must be sufficiently indented and end with a ${expectedEnd}`;
        onError(offset, atRoot ? "MISSING_CHAR" : "BAD_INDENT", msg);
        if (ce && ce.source.length !== 1)
          ee.unshift(ce);
      }
      if (ee.length > 0) {
        const end = resolveEnd.resolveEnd(ee, cePos, ctx.options.strict, onError);
        if (end.comment) {
          if (coll.comment)
            coll.comment += "\n" + end.comment;
          else
            coll.comment = end.comment;
        }
        coll.range = [fc.offset, cePos, end.offset];
      } else {
        coll.range = [fc.offset, cePos, cePos];
      }
      return coll;
    }
    exports.resolveFlowCollection = resolveFlowCollection;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/compose-collection.js
var require_compose_collection = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/compose-collection.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var resolveBlockMap = require_resolve_block_map();
    var resolveBlockSeq = require_resolve_block_seq();
    var resolveFlowCollection = require_resolve_flow_collection();
    function resolveCollection(CN, ctx, token, onError, tagName, tag) {
      const coll = token.type === "block-map" ? resolveBlockMap.resolveBlockMap(CN, ctx, token, onError, tag) : token.type === "block-seq" ? resolveBlockSeq.resolveBlockSeq(CN, ctx, token, onError, tag) : resolveFlowCollection.resolveFlowCollection(CN, ctx, token, onError, tag);
      const Coll = coll.constructor;
      if (tagName === "!" || tagName === Coll.tagName) {
        coll.tag = Coll.tagName;
        return coll;
      }
      if (tagName)
        coll.tag = tagName;
      return coll;
    }
    function composeCollection(CN, ctx, token, props, onError) {
      const tagToken = props.tag;
      const tagName = !tagToken ? null : ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg));
      if (token.type === "block-seq") {
        const { anchor, newlineAfterProp: nl } = props;
        const lastProp = anchor && tagToken ? anchor.offset > tagToken.offset ? anchor : tagToken : anchor ?? tagToken;
        if (lastProp && (!nl || nl.offset < lastProp.offset)) {
          const message = "Missing newline after block sequence props";
          onError(lastProp, "MISSING_CHAR", message);
        }
      }
      const expType = token.type === "block-map" ? "map" : token.type === "block-seq" ? "seq" : token.start.source === "{" ? "map" : "seq";
      if (!tagToken || !tagName || tagName === "!" || tagName === YAMLMap.YAMLMap.tagName && expType === "map" || tagName === YAMLSeq.YAMLSeq.tagName && expType === "seq") {
        return resolveCollection(CN, ctx, token, onError, tagName);
      }
      let tag = ctx.schema.tags.find((t) => t.tag === tagName && t.collection === expType);
      if (!tag) {
        const kt = ctx.schema.knownTags[tagName];
        if (kt?.collection === expType) {
          ctx.schema.tags.push(Object.assign({}, kt, { default: false }));
          tag = kt;
        } else {
          if (kt) {
            onError(tagToken, "BAD_COLLECTION_TYPE", `${kt.tag} used for ${expType} collection, but expects ${kt.collection ?? "scalar"}`, true);
          } else {
            onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, true);
          }
          return resolveCollection(CN, ctx, token, onError, tagName);
        }
      }
      const coll = resolveCollection(CN, ctx, token, onError, tagName, tag);
      const res = tag.resolve?.(coll, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg), ctx.options) ?? coll;
      const node = identity.isNode(res) ? res : new Scalar.Scalar(res);
      node.range = coll.range;
      node.tag = tagName;
      if (tag?.format)
        node.format = tag.format;
      return node;
    }
    exports.composeCollection = composeCollection;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-block-scalar.js
var require_resolve_block_scalar = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-block-scalar.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    function resolveBlockScalar(ctx, scalar, onError) {
      const start = scalar.offset;
      const header = parseBlockScalarHeader(scalar, ctx.options.strict, onError);
      if (!header)
        return { value: "", type: null, comment: "", range: [start, start, start] };
      const type = header.mode === ">" ? Scalar.Scalar.BLOCK_FOLDED : Scalar.Scalar.BLOCK_LITERAL;
      const lines = scalar.source ? splitLines(scalar.source) : [];
      let chompStart = lines.length;
      for (let i = lines.length - 1; i >= 0; --i) {
        const content = lines[i][1];
        if (content === "" || content === "\r")
          chompStart = i;
        else
          break;
      }
      if (chompStart === 0) {
        const value2 = header.chomp === "+" && lines.length > 0 ? "\n".repeat(Math.max(1, lines.length - 1)) : "";
        let end2 = start + header.length;
        if (scalar.source)
          end2 += scalar.source.length;
        return { value: value2, type, comment: header.comment, range: [start, end2, end2] };
      }
      let trimIndent = scalar.indent + header.indent;
      let offset = scalar.offset + header.length;
      let contentStart = 0;
      for (let i = 0; i < chompStart; ++i) {
        const [indent, content] = lines[i];
        if (content === "" || content === "\r") {
          if (header.indent === 0 && indent.length > trimIndent)
            trimIndent = indent.length;
        } else {
          if (indent.length < trimIndent) {
            const message = "Block scalars with more-indented leading empty lines must use an explicit indentation indicator";
            onError(offset + indent.length, "MISSING_CHAR", message);
          }
          if (header.indent === 0)
            trimIndent = indent.length;
          contentStart = i;
          if (trimIndent === 0 && !ctx.atRoot) {
            const message = "Block scalar values in collections must be indented";
            onError(offset, "BAD_INDENT", message);
          }
          break;
        }
        offset += indent.length + content.length + 1;
      }
      for (let i = lines.length - 1; i >= chompStart; --i) {
        if (lines[i][0].length > trimIndent)
          chompStart = i + 1;
      }
      let value = "";
      let sep3 = "";
      let prevMoreIndented = false;
      for (let i = 0; i < contentStart; ++i)
        value += lines[i][0].slice(trimIndent) + "\n";
      for (let i = contentStart; i < chompStart; ++i) {
        let [indent, content] = lines[i];
        offset += indent.length + content.length + 1;
        const crlf = content[content.length - 1] === "\r";
        if (crlf)
          content = content.slice(0, -1);
        if (content && indent.length < trimIndent) {
          const src = header.indent ? "explicit indentation indicator" : "first line";
          const message = `Block scalar lines must not be less indented than their ${src}`;
          onError(offset - content.length - (crlf ? 2 : 1), "BAD_INDENT", message);
          indent = "";
        }
        if (type === Scalar.Scalar.BLOCK_LITERAL) {
          value += sep3 + indent.slice(trimIndent) + content;
          sep3 = "\n";
        } else if (indent.length > trimIndent || content[0] === "	") {
          if (sep3 === " ")
            sep3 = "\n";
          else if (!prevMoreIndented && sep3 === "\n")
            sep3 = "\n\n";
          value += sep3 + indent.slice(trimIndent) + content;
          sep3 = "\n";
          prevMoreIndented = true;
        } else if (content === "") {
          if (sep3 === "\n")
            value += "\n";
          else
            sep3 = "\n";
        } else {
          value += sep3 + content;
          sep3 = " ";
          prevMoreIndented = false;
        }
      }
      switch (header.chomp) {
        case "-":
          break;
        case "+":
          for (let i = chompStart; i < lines.length; ++i)
            value += "\n" + lines[i][0].slice(trimIndent);
          if (value[value.length - 1] !== "\n")
            value += "\n";
          break;
        default:
          value += "\n";
      }
      const end = start + header.length + scalar.source.length;
      return { value, type, comment: header.comment, range: [start, end, end] };
    }
    function parseBlockScalarHeader({ offset, props }, strict, onError) {
      if (props[0].type !== "block-scalar-header") {
        onError(props[0], "IMPOSSIBLE", "Block scalar header not found");
        return null;
      }
      const { source } = props[0];
      const mode = source[0];
      let indent = 0;
      let chomp = "";
      let error = -1;
      for (let i = 1; i < source.length; ++i) {
        const ch = source[i];
        if (!chomp && (ch === "-" || ch === "+"))
          chomp = ch;
        else {
          const n = Number(ch);
          if (!indent && n)
            indent = n;
          else if (error === -1)
            error = offset + i;
        }
      }
      if (error !== -1)
        onError(error, "UNEXPECTED_TOKEN", `Block scalar header includes extra characters: ${source}`);
      let hasSpace = false;
      let comment = "";
      let length = source.length;
      for (let i = 1; i < props.length; ++i) {
        const token = props[i];
        switch (token.type) {
          case "space":
            hasSpace = true;
          // fallthrough
          case "newline":
            length += token.source.length;
            break;
          case "comment":
            if (strict && !hasSpace) {
              const message = "Comments must be separated from other tokens by white space characters";
              onError(token, "MISSING_CHAR", message);
            }
            length += token.source.length;
            comment = token.source.substring(1);
            break;
          case "error":
            onError(token, "UNEXPECTED_TOKEN", token.message);
            length += token.source.length;
            break;
          /* istanbul ignore next should not happen */
          default: {
            const message = `Unexpected token in block scalar header: ${token.type}`;
            onError(token, "UNEXPECTED_TOKEN", message);
            const ts = token.source;
            if (ts && typeof ts === "string")
              length += ts.length;
          }
        }
      }
      return { mode, indent, chomp, comment, length };
    }
    function splitLines(source) {
      const split = source.split(/\n( *)/);
      const first = split[0];
      const m = first.match(/^( *)/);
      const line0 = m?.[1] ? [m[1], first.slice(m[1].length)] : ["", first];
      const lines = [line0];
      for (let i = 1; i < split.length; i += 2)
        lines.push([split[i], split[i + 1]]);
      return lines;
    }
    exports.resolveBlockScalar = resolveBlockScalar;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-flow-scalar.js
var require_resolve_flow_scalar = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-flow-scalar.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var resolveEnd = require_resolve_end();
    function resolveFlowScalar(scalar, strict, onError) {
      const { offset, type, source, end } = scalar;
      let _type;
      let value;
      const _onError = (rel2, code, msg) => onError(offset + rel2, code, msg);
      switch (type) {
        case "scalar":
          _type = Scalar.Scalar.PLAIN;
          value = plainValue(source, _onError);
          break;
        case "single-quoted-scalar":
          _type = Scalar.Scalar.QUOTE_SINGLE;
          value = singleQuotedValue(source, _onError);
          break;
        case "double-quoted-scalar":
          _type = Scalar.Scalar.QUOTE_DOUBLE;
          value = doubleQuotedValue(source, _onError);
          break;
        /* istanbul ignore next should not happen */
        default:
          onError(scalar, "UNEXPECTED_TOKEN", `Expected a flow scalar value, but found: ${type}`);
          return {
            value: "",
            type: null,
            comment: "",
            range: [offset, offset + source.length, offset + source.length]
          };
      }
      const valueEnd = offset + source.length;
      const re = resolveEnd.resolveEnd(end, valueEnd, strict, onError);
      return {
        value,
        type: _type,
        comment: re.comment,
        range: [offset, valueEnd, re.offset]
      };
    }
    function plainValue(source, onError) {
      let badChar = "";
      switch (source[0]) {
        /* istanbul ignore next should not happen */
        case "	":
          badChar = "a tab character";
          break;
        case ",":
          badChar = "flow indicator character ,";
          break;
        case "%":
          badChar = "directive indicator character %";
          break;
        case "|":
        case ">": {
          badChar = `block scalar indicator ${source[0]}`;
          break;
        }
        case "@":
        case "`": {
          badChar = `reserved character ${source[0]}`;
          break;
        }
      }
      if (badChar)
        onError(0, "BAD_SCALAR_START", `Plain value cannot start with ${badChar}`);
      return unfoldLines(source);
    }
    function singleQuotedValue(source, onError) {
      if (source[source.length - 1] !== "'" || source.length === 1)
        onError(source.length, "MISSING_CHAR", "Missing closing 'quote");
      return unfoldLines(source.slice(1, -1)).replace(/''/g, "'");
    }
    function unfoldLines(source) {
      const line = /(.*?)\r?\n/sy;
      let match = line.exec(source);
      if (!match)
        return source;
      let trimEnd, trimBoth;
      try {
        trimEnd = new RegExp("(?<![ 	])[ 	]+$");
        trimBoth = new RegExp("^[ 	]+|(?<![ 	])[ 	]+$", "g");
      } catch {
        trimEnd = /[ \t]+$/;
        trimBoth = /^[ \t]+|[ \t]+$/g;
      }
      let res = match[1].replace(trimEnd, "");
      let sep3 = " ";
      let pos = line.lastIndex;
      while (match = line.exec(source)) {
        const lm = match[1].replace(trimBoth, "");
        if (lm === "") {
          if (sep3 === "\n")
            res += sep3;
          else
            sep3 = "\n";
        } else {
          res += sep3 + lm;
          sep3 = " ";
        }
        pos = line.lastIndex;
      }
      const last = /[ \t]*(.*)/sy;
      last.lastIndex = pos;
      match = last.exec(source);
      return res + sep3 + (match?.[1] ?? "");
    }
    function doubleQuotedValue(source, onError) {
      let res = "";
      for (let i = 1; i < source.length - 1; ++i) {
        const ch = source[i];
        if (ch === "\r" && source[i + 1] === "\n")
          continue;
        if (ch === "\n") {
          const { fold, offset } = foldNewline(source, i);
          res += fold;
          i = offset;
        } else if (ch === "\\") {
          let next = source[++i];
          const cc = escapeCodes[next];
          if (cc)
            res += cc;
          else if (next === "\n") {
            next = source[i + 1];
            while (next === " " || next === "	")
              next = source[++i + 1];
          } else if (next === "\r" && source[i + 1] === "\n") {
            next = source[++i + 1];
            while (next === " " || next === "	")
              next = source[++i + 1];
          } else if (next === "x" || next === "u" || next === "U") {
            const length = next === "x" ? 2 : next === "u" ? 4 : 8;
            res += parseCharCode(source, i + 1, length, onError);
            i += length;
          } else {
            const raw = source.substr(i - 1, 2);
            onError(i - 1, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
            res += raw;
          }
        } else if (ch === " " || ch === "	") {
          const wsStart = i;
          let next = source[i + 1];
          while (next === " " || next === "	")
            next = source[++i + 1];
          if (next !== "\n" && !(next === "\r" && source[i + 2] === "\n"))
            res += i > wsStart ? source.slice(wsStart, i + 1) : ch;
        } else {
          res += ch;
        }
      }
      if (source[source.length - 1] !== '"' || source.length === 1)
        onError(source.length, "MISSING_CHAR", 'Missing closing "quote');
      return res;
    }
    function foldNewline(source, offset) {
      let fold = "";
      let ch = source[offset + 1];
      while (ch === " " || ch === "	" || ch === "\n" || ch === "\r") {
        if (ch === "\r" && source[offset + 2] !== "\n")
          break;
        if (ch === "\n")
          fold += "\n";
        offset += 1;
        ch = source[offset + 1];
      }
      if (!fold)
        fold = " ";
      return { fold, offset };
    }
    var escapeCodes = {
      "0": "\0",
      // null character
      a: "\x07",
      // bell character
      b: "\b",
      // backspace
      e: "\x1B",
      // escape character
      f: "\f",
      // form feed
      n: "\n",
      // line feed
      r: "\r",
      // carriage return
      t: "	",
      // horizontal tab
      v: "\v",
      // vertical tab
      N: "\x85",
      // Unicode next line
      _: "\xA0",
      // Unicode non-breaking space
      L: "\u2028",
      // Unicode line separator
      P: "\u2029",
      // Unicode paragraph separator
      " ": " ",
      '"': '"',
      "/": "/",
      "\\": "\\",
      "	": "	"
    };
    function parseCharCode(source, offset, length, onError) {
      const cc = source.substr(offset, length);
      const ok = cc.length === length && /^[0-9a-fA-F]+$/.test(cc);
      const code = ok ? parseInt(cc, 16) : NaN;
      try {
        return String.fromCodePoint(code);
      } catch {
        const raw = source.substr(offset - 2, length + 2);
        onError(offset - 2, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
        return raw;
      }
    }
    exports.resolveFlowScalar = resolveFlowScalar;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/compose-scalar.js
var require_compose_scalar = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/compose-scalar.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var resolveBlockScalar = require_resolve_block_scalar();
    var resolveFlowScalar = require_resolve_flow_scalar();
    function composeScalar(ctx, token, tagToken, onError) {
      const { value, type, comment, range } = token.type === "block-scalar" ? resolveBlockScalar.resolveBlockScalar(ctx, token, onError) : resolveFlowScalar.resolveFlowScalar(token, ctx.options.strict, onError);
      const tagName = tagToken ? ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg)) : null;
      let tag;
      if (ctx.options.stringKeys && ctx.atKey) {
        tag = ctx.schema[identity.SCALAR];
      } else if (tagName)
        tag = findScalarTagByName(ctx.schema, value, tagName, tagToken, onError);
      else if (token.type === "scalar")
        tag = findScalarTagByTest(ctx, value, token, onError);
      else
        tag = ctx.schema[identity.SCALAR];
      let scalar;
      try {
        const res = tag.resolve(value, (msg) => onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg), ctx.options);
        scalar = identity.isScalar(res) ? res : new Scalar.Scalar(res);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg);
        scalar = new Scalar.Scalar(value);
      }
      scalar.range = range;
      scalar.source = value;
      if (type)
        scalar.type = type;
      if (tagName)
        scalar.tag = tagName;
      if (tag.format)
        scalar.format = tag.format;
      if (comment)
        scalar.comment = comment;
      return scalar;
    }
    function findScalarTagByName(schema, value, tagName, tagToken, onError) {
      if (tagName === "!")
        return schema[identity.SCALAR];
      const matchWithTest = [];
      for (const tag of schema.tags) {
        if (!tag.collection && tag.tag === tagName) {
          if (tag.default && tag.test)
            matchWithTest.push(tag);
          else
            return tag;
        }
      }
      for (const tag of matchWithTest)
        if (tag.test?.test(value))
          return tag;
      const kt = schema.knownTags[tagName];
      if (kt && !kt.collection) {
        schema.tags.push(Object.assign({}, kt, { default: false, test: void 0 }));
        return kt;
      }
      onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, tagName !== "tag:yaml.org,2002:str");
      return schema[identity.SCALAR];
    }
    function findScalarTagByTest({ atKey, directives, schema }, value, token, onError) {
      const tag = schema.tags.find((tag2) => (tag2.default === true || atKey && tag2.default === "key") && tag2.test?.test(value)) || schema[identity.SCALAR];
      if (schema.compat) {
        const compat = schema.compat.find((tag2) => tag2.default && tag2.test?.test(value)) ?? schema[identity.SCALAR];
        if (tag.tag !== compat.tag) {
          const ts = directives.tagString(tag.tag);
          const cs = directives.tagString(compat.tag);
          const msg = `Value may be parsed as either ${ts} or ${cs}`;
          onError(token, "TAG_RESOLVE_FAILED", msg, true);
        }
      }
      return tag;
    }
    exports.composeScalar = composeScalar;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/util-empty-scalar-position.js
var require_util_empty_scalar_position = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/util-empty-scalar-position.js"(exports) {
    "use strict";
    function emptyScalarPosition(offset, before, pos) {
      if (before) {
        pos ?? (pos = before.length);
        for (let i = pos - 1; i >= 0; --i) {
          let st = before[i];
          switch (st.type) {
            case "space":
            case "comment":
            case "newline":
              offset -= st.source.length;
              continue;
          }
          st = before[++i];
          while (st?.type === "space") {
            offset += st.source.length;
            st = before[++i];
          }
          break;
        }
      }
      return offset;
    }
    exports.emptyScalarPosition = emptyScalarPosition;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/compose-node.js
var require_compose_node = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/compose-node.js"(exports) {
    "use strict";
    var Alias = require_Alias();
    var identity = require_identity();
    var composeCollection = require_compose_collection();
    var composeScalar = require_compose_scalar();
    var resolveEnd = require_resolve_end();
    var utilEmptyScalarPosition = require_util_empty_scalar_position();
    var CN = { composeNode, composeEmptyNode };
    function composeNode(ctx, token, props, onError) {
      const atKey = ctx.atKey;
      const { spaceBefore, comment, anchor, tag } = props;
      let node;
      let isSrcToken = true;
      switch (token.type) {
        case "alias":
          node = composeAlias(ctx, token, onError);
          if (anchor || tag)
            onError(token, "ALIAS_PROPS", "An alias node must not specify any properties");
          break;
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
        case "block-scalar":
          node = composeScalar.composeScalar(ctx, token, tag, onError);
          if (anchor)
            node.anchor = anchor.source.substring(1);
          break;
        case "block-map":
        case "block-seq":
        case "flow-collection":
          try {
            node = composeCollection.composeCollection(CN, ctx, token, props, onError);
            if (anchor)
              node.anchor = anchor.source.substring(1);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            onError(token, "RESOURCE_EXHAUSTION", message);
          }
          break;
        default: {
          const message = token.type === "error" ? token.message : `Unsupported token (type: ${token.type})`;
          onError(token, "UNEXPECTED_TOKEN", message);
          isSrcToken = false;
        }
      }
      node ?? (node = composeEmptyNode(ctx, token.offset, void 0, null, props, onError));
      if (anchor && node.anchor === "")
        onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
      if (atKey && ctx.options.stringKeys && (!identity.isScalar(node) || typeof node.value !== "string" || node.tag && node.tag !== "tag:yaml.org,2002:str")) {
        const msg = "With stringKeys, all keys must be strings";
        onError(tag ?? token, "NON_STRING_KEY", msg);
      }
      if (spaceBefore)
        node.spaceBefore = true;
      if (comment) {
        if (token.type === "scalar" && token.source === "")
          node.comment = comment;
        else
          node.commentBefore = comment;
      }
      if (ctx.options.keepSourceTokens && isSrcToken)
        node.srcToken = token;
      return node;
    }
    function composeEmptyNode(ctx, offset, before, pos, { spaceBefore, comment, anchor, tag, end }, onError) {
      const token = {
        type: "scalar",
        offset: utilEmptyScalarPosition.emptyScalarPosition(offset, before, pos),
        indent: -1,
        source: ""
      };
      const node = composeScalar.composeScalar(ctx, token, tag, onError);
      if (anchor) {
        node.anchor = anchor.source.substring(1);
        if (node.anchor === "")
          onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
      }
      if (spaceBefore)
        node.spaceBefore = true;
      if (comment) {
        node.comment = comment;
        node.range[2] = end;
      }
      return node;
    }
    function composeAlias({ options }, { offset, source, end }, onError) {
      const alias = new Alias.Alias(source.substring(1));
      if (alias.source === "")
        onError(offset, "BAD_ALIAS", "Alias cannot be an empty string");
      if (alias.source.endsWith(":"))
        onError(offset + source.length - 1, "BAD_ALIAS", "Alias ending in : is ambiguous", true);
      const valueEnd = offset + source.length;
      const re = resolveEnd.resolveEnd(end, valueEnd, options.strict, onError);
      alias.range = [offset, valueEnd, re.offset];
      if (re.comment)
        alias.comment = re.comment;
      return alias;
    }
    exports.composeEmptyNode = composeEmptyNode;
    exports.composeNode = composeNode;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/compose-doc.js
var require_compose_doc = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/compose-doc.js"(exports) {
    "use strict";
    var Document = require_Document();
    var composeNode = require_compose_node();
    var resolveEnd = require_resolve_end();
    var resolveProps = require_resolve_props();
    function composeDoc(options, directives, { offset, start, value, end }, onError) {
      const opts = Object.assign({ _directives: directives }, options);
      const doc = new Document.Document(void 0, opts);
      const ctx = {
        atKey: false,
        atRoot: true,
        directives: doc.directives,
        options: doc.options,
        schema: doc.schema
      };
      const props = resolveProps.resolveProps(start, {
        indicator: "doc-start",
        next: value ?? end?.[0],
        offset,
        onError,
        parentIndent: 0,
        startOnNewline: true
      });
      if (props.found) {
        doc.directives.docStart = true;
        if (value && (value.type === "block-map" || value.type === "block-seq") && !props.hasNewline)
          onError(props.end, "MISSING_CHAR", "Block collection cannot start on same line with directives-end marker");
      }
      doc.contents = value ? composeNode.composeNode(ctx, value, props, onError) : composeNode.composeEmptyNode(ctx, props.end, start, null, props, onError);
      const contentEnd = doc.contents.range[2];
      const re = resolveEnd.resolveEnd(end, contentEnd, false, onError);
      if (re.comment)
        doc.comment = re.comment;
      doc.range = [offset, contentEnd, re.offset];
      return doc;
    }
    exports.composeDoc = composeDoc;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/composer.js
var require_composer = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/composer.js"(exports) {
    "use strict";
    var node_process = __require("process");
    var directives = require_directives();
    var Document = require_Document();
    var errors = require_errors();
    var identity = require_identity();
    var composeDoc = require_compose_doc();
    var resolveEnd = require_resolve_end();
    function getErrorPos(src) {
      if (typeof src === "number")
        return [src, src + 1];
      if (Array.isArray(src))
        return src.length === 2 ? src : [src[0], src[1]];
      const { offset, source } = src;
      return [offset, offset + (typeof source === "string" ? source.length : 1)];
    }
    function parsePrelude(prelude) {
      let comment = "";
      let atComment = false;
      let afterEmptyLine = false;
      for (let i = 0; i < prelude.length; ++i) {
        const source = prelude[i];
        switch (source[0]) {
          case "#":
            comment += (comment === "" ? "" : afterEmptyLine ? "\n\n" : "\n") + (source.substring(1) || " ");
            atComment = true;
            afterEmptyLine = false;
            break;
          case "%":
            if (prelude[i + 1]?.[0] !== "#")
              i += 1;
            atComment = false;
            break;
          default:
            if (!atComment)
              afterEmptyLine = true;
            atComment = false;
        }
      }
      return { comment, afterEmptyLine };
    }
    var Composer = class {
      constructor(options = {}) {
        this.doc = null;
        this.atDirectives = false;
        this.prelude = [];
        this.errors = [];
        this.warnings = [];
        this.onError = (source, code, message, warning) => {
          const pos = getErrorPos(source);
          if (warning)
            this.warnings.push(new errors.YAMLWarning(pos, code, message));
          else
            this.errors.push(new errors.YAMLParseError(pos, code, message));
        };
        this.directives = new directives.Directives({ version: options.version || "1.2" });
        this.options = options;
      }
      decorate(doc, afterDoc) {
        const { comment, afterEmptyLine } = parsePrelude(this.prelude);
        if (comment) {
          const dc = doc.contents;
          if (afterDoc) {
            doc.comment = doc.comment ? `${doc.comment}
${comment}` : comment;
          } else if (afterEmptyLine || doc.directives.docStart || !dc) {
            doc.commentBefore = comment;
          } else if (identity.isCollection(dc) && !dc.flow && dc.items.length > 0) {
            let it = dc.items[0];
            if (identity.isPair(it))
              it = it.key;
            const cb = it.commentBefore;
            it.commentBefore = cb ? `${comment}
${cb}` : comment;
          } else {
            const cb = dc.commentBefore;
            dc.commentBefore = cb ? `${comment}
${cb}` : comment;
          }
        }
        if (afterDoc) {
          for (let i = 0; i < this.errors.length; ++i)
            doc.errors.push(this.errors[i]);
          for (let i = 0; i < this.warnings.length; ++i)
            doc.warnings.push(this.warnings[i]);
        } else {
          doc.errors = this.errors;
          doc.warnings = this.warnings;
        }
        this.prelude = [];
        this.errors = [];
        this.warnings = [];
      }
      /**
       * Current stream status information.
       *
       * Mostly useful at the end of input for an empty stream.
       */
      streamInfo() {
        return {
          comment: parsePrelude(this.prelude).comment,
          directives: this.directives,
          errors: this.errors,
          warnings: this.warnings
        };
      }
      /**
       * Compose tokens into documents.
       *
       * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
       * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
       */
      *compose(tokens, forceDoc = false, endOffset = -1) {
        for (const token of tokens)
          yield* this.next(token);
        yield* this.end(forceDoc, endOffset);
      }
      /** Advance the composer by one CST token. */
      *next(token) {
        if (node_process.env.LOG_STREAM)
          console.dir(token, { depth: null });
        switch (token.type) {
          case "directive":
            this.directives.add(token.source, (offset, message, warning) => {
              const pos = getErrorPos(token);
              pos[0] += offset;
              this.onError(pos, "BAD_DIRECTIVE", message, warning);
            });
            this.prelude.push(token.source);
            this.atDirectives = true;
            break;
          case "document": {
            const doc = composeDoc.composeDoc(this.options, this.directives, token, this.onError);
            if (this.atDirectives && !doc.directives.docStart)
              this.onError(token, "MISSING_CHAR", "Missing directives-end/doc-start indicator line");
            this.decorate(doc, false);
            if (this.doc)
              yield this.doc;
            this.doc = doc;
            this.atDirectives = false;
            break;
          }
          case "byte-order-mark":
          case "space":
            break;
          case "comment":
          case "newline":
            this.prelude.push(token.source);
            break;
          case "error": {
            const msg = token.source ? `${token.message}: ${JSON.stringify(token.source)}` : token.message;
            const error = new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg);
            if (this.atDirectives || !this.doc)
              this.errors.push(error);
            else
              this.doc.errors.push(error);
            break;
          }
          case "doc-end": {
            if (!this.doc) {
              const msg = "Unexpected doc-end without preceding document";
              this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg));
              break;
            }
            this.doc.directives.docEnd = true;
            const end = resolveEnd.resolveEnd(token.end, token.offset + token.source.length, this.doc.options.strict, this.onError);
            this.decorate(this.doc, true);
            if (end.comment) {
              const dc = this.doc.comment;
              this.doc.comment = dc ? `${dc}
${end.comment}` : end.comment;
            }
            this.doc.range[2] = end.offset;
            break;
          }
          default:
            this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", `Unsupported token ${token.type}`));
        }
      }
      /**
       * Call at end of input to yield any remaining document.
       *
       * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
       * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
       */
      *end(forceDoc = false, endOffset = -1) {
        if (this.doc) {
          this.decorate(this.doc, true);
          yield this.doc;
          this.doc = null;
        } else if (forceDoc) {
          const opts = Object.assign({ _directives: this.directives }, this.options);
          const doc = new Document.Document(void 0, opts);
          if (this.atDirectives)
            this.onError(endOffset, "MISSING_CHAR", "Missing directives-end indicator line");
          doc.range = [0, endOffset, endOffset];
          this.decorate(doc, false);
          yield doc;
        }
      }
    };
    exports.Composer = Composer;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/cst-scalar.js
var require_cst_scalar = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/cst-scalar.js"(exports) {
    "use strict";
    var resolveBlockScalar = require_resolve_block_scalar();
    var resolveFlowScalar = require_resolve_flow_scalar();
    var errors = require_errors();
    var stringifyString = require_stringifyString();
    function resolveAsScalar(token, strict = true, onError) {
      if (token) {
        const _onError = (pos, code, message) => {
          const offset = typeof pos === "number" ? pos : Array.isArray(pos) ? pos[0] : pos.offset;
          if (onError)
            onError(offset, code, message);
          else
            throw new errors.YAMLParseError([offset, offset + 1], code, message);
        };
        switch (token.type) {
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return resolveFlowScalar.resolveFlowScalar(token, strict, _onError);
          case "block-scalar":
            return resolveBlockScalar.resolveBlockScalar({ options: { strict } }, token, _onError);
        }
      }
      return null;
    }
    function createScalarToken(value, context) {
      const { implicitKey = false, indent, inFlow = false, offset = -1, type = "PLAIN" } = context;
      const source = stringifyString.stringifyString({ type, value }, {
        implicitKey,
        indent: indent > 0 ? " ".repeat(indent) : "",
        inFlow,
        options: { blockQuote: true, lineWidth: -1 }
      });
      const end = context.end ?? [
        { type: "newline", offset: -1, indent, source: "\n" }
      ];
      switch (source[0]) {
        case "|":
        case ">": {
          const he = source.indexOf("\n");
          const head = source.substring(0, he);
          const body = source.substring(he + 1) + "\n";
          const props = [
            { type: "block-scalar-header", offset, indent, source: head }
          ];
          if (!addEndtoBlockProps(props, end))
            props.push({ type: "newline", offset: -1, indent, source: "\n" });
          return { type: "block-scalar", offset, indent, props, source: body };
        }
        case '"':
          return { type: "double-quoted-scalar", offset, indent, source, end };
        case "'":
          return { type: "single-quoted-scalar", offset, indent, source, end };
        default:
          return { type: "scalar", offset, indent, source, end };
      }
    }
    function setScalarValue(token, value, context = {}) {
      let { afterKey = false, implicitKey = false, inFlow = false, type } = context;
      let indent = "indent" in token ? token.indent : null;
      if (afterKey && typeof indent === "number")
        indent += 2;
      if (!type)
        switch (token.type) {
          case "single-quoted-scalar":
            type = "QUOTE_SINGLE";
            break;
          case "double-quoted-scalar":
            type = "QUOTE_DOUBLE";
            break;
          case "block-scalar": {
            const header = token.props[0];
            if (header.type !== "block-scalar-header")
              throw new Error("Invalid block scalar header");
            type = header.source[0] === ">" ? "BLOCK_FOLDED" : "BLOCK_LITERAL";
            break;
          }
          default:
            type = "PLAIN";
        }
      const source = stringifyString.stringifyString({ type, value }, {
        implicitKey: implicitKey || indent === null,
        indent: indent !== null && indent > 0 ? " ".repeat(indent) : "",
        inFlow,
        options: { blockQuote: true, lineWidth: -1 }
      });
      switch (source[0]) {
        case "|":
        case ">":
          setBlockScalarValue(token, source);
          break;
        case '"':
          setFlowScalarValue(token, source, "double-quoted-scalar");
          break;
        case "'":
          setFlowScalarValue(token, source, "single-quoted-scalar");
          break;
        default:
          setFlowScalarValue(token, source, "scalar");
      }
    }
    function setBlockScalarValue(token, source) {
      const he = source.indexOf("\n");
      const head = source.substring(0, he);
      const body = source.substring(he + 1) + "\n";
      if (token.type === "block-scalar") {
        const header = token.props[0];
        if (header.type !== "block-scalar-header")
          throw new Error("Invalid block scalar header");
        header.source = head;
        token.source = body;
      } else {
        const { offset } = token;
        const indent = "indent" in token ? token.indent : -1;
        const props = [
          { type: "block-scalar-header", offset, indent, source: head }
        ];
        if (!addEndtoBlockProps(props, "end" in token ? token.end : void 0))
          props.push({ type: "newline", offset: -1, indent, source: "\n" });
        for (const key of Object.keys(token))
          if (key !== "type" && key !== "offset")
            delete token[key];
        Object.assign(token, { type: "block-scalar", indent, props, source: body });
      }
    }
    function addEndtoBlockProps(props, end) {
      if (end)
        for (const st of end)
          switch (st.type) {
            case "space":
            case "comment":
              props.push(st);
              break;
            case "newline":
              props.push(st);
              return true;
          }
      return false;
    }
    function setFlowScalarValue(token, source, type) {
      switch (token.type) {
        case "scalar":
        case "double-quoted-scalar":
        case "single-quoted-scalar":
          token.type = type;
          token.source = source;
          break;
        case "block-scalar": {
          const end = token.props.slice(1);
          let oa = source.length;
          if (token.props[0].type === "block-scalar-header")
            oa -= token.props[0].source.length;
          for (const tok of end)
            tok.offset += oa;
          delete token.props;
          Object.assign(token, { type, source, end });
          break;
        }
        case "block-map":
        case "block-seq": {
          const offset = token.offset + source.length;
          const nl = { type: "newline", offset, indent: token.indent, source: "\n" };
          delete token.items;
          Object.assign(token, { type, source, end: [nl] });
          break;
        }
        default: {
          const indent = "indent" in token ? token.indent : -1;
          const end = "end" in token && Array.isArray(token.end) ? token.end.filter((st) => st.type === "space" || st.type === "comment" || st.type === "newline") : [];
          for (const key of Object.keys(token))
            if (key !== "type" && key !== "offset")
              delete token[key];
          Object.assign(token, { type, indent, source, end });
        }
      }
    }
    exports.createScalarToken = createScalarToken;
    exports.resolveAsScalar = resolveAsScalar;
    exports.setScalarValue = setScalarValue;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/cst-stringify.js
var require_cst_stringify = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/cst-stringify.js"(exports) {
    "use strict";
    var stringify = (cst) => "type" in cst ? stringifyToken(cst) : stringifyItem(cst);
    function stringifyToken(token) {
      switch (token.type) {
        case "block-scalar": {
          let res = "";
          for (const tok of token.props)
            res += stringifyToken(tok);
          return res + token.source;
        }
        case "block-map":
        case "block-seq": {
          let res = "";
          for (const item of token.items)
            res += stringifyItem(item);
          return res;
        }
        case "flow-collection": {
          let res = token.start.source;
          for (const item of token.items)
            res += stringifyItem(item);
          for (const st of token.end)
            res += st.source;
          return res;
        }
        case "document": {
          let res = stringifyItem(token);
          if (token.end)
            for (const st of token.end)
              res += st.source;
          return res;
        }
        default: {
          let res = token.source;
          if ("end" in token && token.end)
            for (const st of token.end)
              res += st.source;
          return res;
        }
      }
    }
    function stringifyItem({ start, key, sep: sep3, value }) {
      let res = "";
      for (const st of start)
        res += st.source;
      if (key)
        res += stringifyToken(key);
      if (sep3)
        for (const st of sep3)
          res += st.source;
      if (value)
        res += stringifyToken(value);
      return res;
    }
    exports.stringify = stringify;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/cst-visit.js
var require_cst_visit = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/cst-visit.js"(exports) {
    "use strict";
    var BREAK = /* @__PURE__ */ Symbol("break visit");
    var SKIP = /* @__PURE__ */ Symbol("skip children");
    var REMOVE = /* @__PURE__ */ Symbol("remove item");
    function visit(cst, visitor) {
      if ("type" in cst && cst.type === "document")
        cst = { start: cst.start, value: cst.value };
      _visit(Object.freeze([]), cst, visitor);
    }
    visit.BREAK = BREAK;
    visit.SKIP = SKIP;
    visit.REMOVE = REMOVE;
    visit.itemAtPath = (cst, path2) => {
      let item = cst;
      for (const [field, index] of path2) {
        const tok = item?.[field];
        if (tok && "items" in tok) {
          item = tok.items[index];
        } else
          return void 0;
      }
      return item;
    };
    visit.parentCollection = (cst, path2) => {
      const parent = visit.itemAtPath(cst, path2.slice(0, -1));
      const field = path2[path2.length - 1][0];
      const coll = parent?.[field];
      if (coll && "items" in coll)
        return coll;
      throw new Error("Parent collection not found");
    };
    function _visit(path2, item, visitor) {
      let ctrl = visitor(item, path2);
      if (typeof ctrl === "symbol")
        return ctrl;
      for (const field of ["key", "value"]) {
        const token = item[field];
        if (token && "items" in token) {
          for (let i = 0; i < token.items.length; ++i) {
            const ci = _visit(Object.freeze(path2.concat([[field, i]])), token.items[i], visitor);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              token.items.splice(i, 1);
              i -= 1;
            }
          }
          if (typeof ctrl === "function" && field === "key")
            ctrl = ctrl(item, path2);
        }
      }
      return typeof ctrl === "function" ? ctrl(item, path2) : ctrl;
    }
    exports.visit = visit;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/cst.js
var require_cst = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/cst.js"(exports) {
    "use strict";
    var cstScalar = require_cst_scalar();
    var cstStringify = require_cst_stringify();
    var cstVisit = require_cst_visit();
    var BOM3 = "\uFEFF";
    var DOCUMENT = "";
    var FLOW_END = "";
    var SCALAR = "";
    var isCollection = (token) => !!token && "items" in token;
    var isScalar2 = (token) => !!token && (token.type === "scalar" || token.type === "single-quoted-scalar" || token.type === "double-quoted-scalar" || token.type === "block-scalar");
    function prettyToken(token) {
      switch (token) {
        case BOM3:
          return "<BOM>";
        case DOCUMENT:
          return "<DOC>";
        case FLOW_END:
          return "<FLOW_END>";
        case SCALAR:
          return "<SCALAR>";
        default:
          return JSON.stringify(token);
      }
    }
    function tokenType(source) {
      switch (source) {
        case BOM3:
          return "byte-order-mark";
        case DOCUMENT:
          return "doc-mode";
        case FLOW_END:
          return "flow-error-end";
        case SCALAR:
          return "scalar";
        case "---":
          return "doc-start";
        case "...":
          return "doc-end";
        case "":
        case "\n":
        case "\r\n":
          return "newline";
        case "-":
          return "seq-item-ind";
        case "?":
          return "explicit-key-ind";
        case ":":
          return "map-value-ind";
        case "{":
          return "flow-map-start";
        case "}":
          return "flow-map-end";
        case "[":
          return "flow-seq-start";
        case "]":
          return "flow-seq-end";
        case ",":
          return "comma";
      }
      switch (source[0]) {
        case " ":
        case "	":
          return "space";
        case "#":
          return "comment";
        case "%":
          return "directive-line";
        case "*":
          return "alias";
        case "&":
          return "anchor";
        case "!":
          return "tag";
        case "'":
          return "single-quoted-scalar";
        case '"':
          return "double-quoted-scalar";
        case "|":
        case ">":
          return "block-scalar-header";
      }
      return null;
    }
    exports.createScalarToken = cstScalar.createScalarToken;
    exports.resolveAsScalar = cstScalar.resolveAsScalar;
    exports.setScalarValue = cstScalar.setScalarValue;
    exports.stringify = cstStringify.stringify;
    exports.visit = cstVisit.visit;
    exports.BOM = BOM3;
    exports.DOCUMENT = DOCUMENT;
    exports.FLOW_END = FLOW_END;
    exports.SCALAR = SCALAR;
    exports.isCollection = isCollection;
    exports.isScalar = isScalar2;
    exports.prettyToken = prettyToken;
    exports.tokenType = tokenType;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/lexer.js
var require_lexer = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/lexer.js"(exports) {
    "use strict";
    var cst = require_cst();
    function isEmpty(ch) {
      switch (ch) {
        case void 0:
        case " ":
        case "\n":
        case "\r":
        case "	":
          return true;
        default:
          return false;
      }
    }
    var hexDigits = new Set("0123456789ABCDEFabcdef");
    var tagChars = new Set("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-#;/?:@&=+$_.!~*'()");
    var flowIndicatorChars = new Set(",[]{}");
    var invalidAnchorChars = new Set(" ,[]{}\n\r	");
    var isNotAnchorChar = (ch) => !ch || invalidAnchorChars.has(ch);
    var Lexer = class {
      constructor() {
        this.atEnd = false;
        this.blockScalarIndent = -1;
        this.blockScalarKeep = false;
        this.buffer = "";
        this.flowKey = false;
        this.flowLevel = 0;
        this.indentNext = 0;
        this.indentValue = 0;
        this.lineEndPos = null;
        this.next = null;
        this.pos = 0;
      }
      /**
       * Generate YAML tokens from the `source` string. If `incomplete`,
       * a part of the last line may be left as a buffer for the next call.
       *
       * @returns A generator of lexical tokens
       */
      *lex(source, incomplete = false) {
        if (source) {
          if (typeof source !== "string")
            throw TypeError("source is not a string");
          this.buffer = this.buffer ? this.buffer + source : source;
          this.lineEndPos = null;
        }
        this.atEnd = !incomplete;
        let next = this.next ?? "stream";
        while (next && (incomplete || this.hasChars(1)))
          next = yield* this.parseNext(next);
      }
      atLineEnd() {
        let i = this.pos;
        let ch = this.buffer[i];
        while (ch === " " || ch === "	")
          ch = this.buffer[++i];
        if (!ch || ch === "#" || ch === "\n")
          return true;
        if (ch === "\r")
          return this.buffer[i + 1] === "\n";
        return false;
      }
      charAt(n) {
        return this.buffer[this.pos + n];
      }
      continueScalar(offset) {
        let ch = this.buffer[offset];
        if (this.indentNext > 0) {
          let indent = 0;
          while (ch === " ")
            ch = this.buffer[++indent + offset];
          if (ch === "\r") {
            const next = this.buffer[indent + offset + 1];
            if (next === "\n" || !next && !this.atEnd)
              return offset + indent + 1;
          }
          return ch === "\n" || indent >= this.indentNext || !ch && !this.atEnd ? offset + indent : -1;
        }
        if (ch === "-" || ch === ".") {
          const dt = this.buffer.substr(offset, 3);
          if ((dt === "---" || dt === "...") && isEmpty(this.buffer[offset + 3]))
            return -1;
        }
        return offset;
      }
      getLine() {
        let end = this.lineEndPos;
        if (typeof end !== "number" || end !== -1 && end < this.pos) {
          end = this.buffer.indexOf("\n", this.pos);
          this.lineEndPos = end;
        }
        if (end === -1)
          return this.atEnd ? this.buffer.substring(this.pos) : null;
        if (this.buffer[end - 1] === "\r")
          end -= 1;
        return this.buffer.substring(this.pos, end);
      }
      hasChars(n) {
        return this.pos + n <= this.buffer.length;
      }
      setNext(state) {
        this.buffer = this.buffer.substring(this.pos);
        this.pos = 0;
        this.lineEndPos = null;
        this.next = state;
        return null;
      }
      peek(n) {
        return this.buffer.substr(this.pos, n);
      }
      *parseNext(next) {
        switch (next) {
          case "stream":
            return yield* this.parseStream();
          case "line-start":
            return yield* this.parseLineStart();
          case "block-start":
            return yield* this.parseBlockStart();
          case "doc":
            return yield* this.parseDocument();
          case "flow":
            return yield* this.parseFlowCollection();
          case "quoted-scalar":
            return yield* this.parseQuotedScalar();
          case "block-scalar":
            return yield* this.parseBlockScalar();
          case "plain-scalar":
            return yield* this.parsePlainScalar();
        }
      }
      *parseStream() {
        let line = this.getLine();
        if (line === null)
          return this.setNext("stream");
        if (line[0] === cst.BOM) {
          yield* this.pushCount(1);
          line = line.substring(1);
        }
        if (line[0] === "%") {
          let dirEnd = line.length;
          let cs = line.indexOf("#");
          while (cs !== -1) {
            const ch = line[cs - 1];
            if (ch === " " || ch === "	") {
              dirEnd = cs - 1;
              break;
            } else {
              cs = line.indexOf("#", cs + 1);
            }
          }
          while (true) {
            const ch = line[dirEnd - 1];
            if (ch === " " || ch === "	")
              dirEnd -= 1;
            else
              break;
          }
          const n = (yield* this.pushCount(dirEnd)) + (yield* this.pushSpaces(true));
          yield* this.pushCount(line.length - n);
          this.pushNewline();
          return "stream";
        }
        if (this.atLineEnd()) {
          const sp = yield* this.pushSpaces(true);
          yield* this.pushCount(line.length - sp);
          yield* this.pushNewline();
          return "stream";
        }
        yield cst.DOCUMENT;
        return yield* this.parseLineStart();
      }
      *parseLineStart() {
        const ch = this.charAt(0);
        if (!ch && !this.atEnd)
          return this.setNext("line-start");
        if (ch === "-" || ch === ".") {
          if (!this.atEnd && !this.hasChars(4))
            return this.setNext("line-start");
          const s = this.peek(3);
          if ((s === "---" || s === "...") && isEmpty(this.charAt(3))) {
            yield* this.pushCount(3);
            this.indentValue = 0;
            this.indentNext = 0;
            return s === "---" ? "doc" : "stream";
          }
        }
        this.indentValue = yield* this.pushSpaces(false);
        if (this.indentNext > this.indentValue && !isEmpty(this.charAt(1)))
          this.indentNext = this.indentValue;
        return yield* this.parseBlockStart();
      }
      *parseBlockStart() {
        const [ch0, ch1] = this.peek(2);
        if (!ch1 && !this.atEnd)
          return this.setNext("block-start");
        if ((ch0 === "-" || ch0 === "?" || ch0 === ":") && isEmpty(ch1)) {
          const n = (yield* this.pushCount(1)) + (yield* this.pushSpaces(true));
          this.indentNext = this.indentValue + 1;
          this.indentValue += n;
          return "block-start";
        }
        return "doc";
      }
      *parseDocument() {
        yield* this.pushSpaces(true);
        const line = this.getLine();
        if (line === null)
          return this.setNext("doc");
        let n = yield* this.pushIndicators();
        switch (line[n]) {
          case "#":
            yield* this.pushCount(line.length - n);
          // fallthrough
          case void 0:
            yield* this.pushNewline();
            return yield* this.parseLineStart();
          case "{":
          case "[":
            yield* this.pushCount(1);
            this.flowKey = false;
            this.flowLevel = 1;
            return "flow";
          case "}":
          case "]":
            yield* this.pushCount(1);
            return "doc";
          case "*":
            yield* this.pushUntil(isNotAnchorChar);
            return "doc";
          case '"':
          case "'":
            return yield* this.parseQuotedScalar();
          case "|":
          case ">":
            n += yield* this.parseBlockScalarHeader();
            n += yield* this.pushSpaces(true);
            yield* this.pushCount(line.length - n);
            yield* this.pushNewline();
            return yield* this.parseBlockScalar();
          default:
            return yield* this.parsePlainScalar();
        }
      }
      *parseFlowCollection() {
        let nl, sp;
        let indent = -1;
        do {
          nl = yield* this.pushNewline();
          if (nl > 0) {
            sp = yield* this.pushSpaces(false);
            this.indentValue = indent = sp;
          } else {
            sp = 0;
          }
          sp += yield* this.pushSpaces(true);
        } while (nl + sp > 0);
        const line = this.getLine();
        if (line === null)
          return this.setNext("flow");
        if (indent !== -1 && indent < this.indentNext && line[0] !== "#" || indent === 0 && (line.startsWith("---") || line.startsWith("...")) && isEmpty(line[3])) {
          const atFlowEndMarker = indent === this.indentNext - 1 && this.flowLevel === 1 && (line[0] === "]" || line[0] === "}");
          if (!atFlowEndMarker) {
            this.flowLevel = 0;
            yield cst.FLOW_END;
            return yield* this.parseLineStart();
          }
        }
        let n = 0;
        while (line[n] === ",") {
          n += yield* this.pushCount(1);
          n += yield* this.pushSpaces(true);
          this.flowKey = false;
        }
        n += yield* this.pushIndicators();
        switch (line[n]) {
          case void 0:
            return "flow";
          case "#":
            yield* this.pushCount(line.length - n);
            return "flow";
          case "{":
          case "[":
            yield* this.pushCount(1);
            this.flowKey = false;
            this.flowLevel += 1;
            return "flow";
          case "}":
          case "]":
            yield* this.pushCount(1);
            this.flowKey = true;
            this.flowLevel -= 1;
            return this.flowLevel ? "flow" : "doc";
          case "*":
            yield* this.pushUntil(isNotAnchorChar);
            return "flow";
          case '"':
          case "'":
            this.flowKey = true;
            return yield* this.parseQuotedScalar();
          case ":": {
            const next = this.charAt(1);
            if (this.flowKey || isEmpty(next) || next === ",") {
              this.flowKey = false;
              yield* this.pushCount(1);
              yield* this.pushSpaces(true);
              return "flow";
            }
          }
          // fallthrough
          default:
            this.flowKey = false;
            return yield* this.parsePlainScalar();
        }
      }
      *parseQuotedScalar() {
        const quote2 = this.charAt(0);
        let end = this.buffer.indexOf(quote2, this.pos + 1);
        if (quote2 === "'") {
          while (end !== -1 && this.buffer[end + 1] === "'")
            end = this.buffer.indexOf("'", end + 2);
        } else {
          while (end !== -1) {
            let n = 0;
            while (this.buffer[end - 1 - n] === "\\")
              n += 1;
            if (n % 2 === 0)
              break;
            end = this.buffer.indexOf('"', end + 1);
          }
        }
        const qb = this.buffer.substring(0, end);
        let nl = qb.indexOf("\n", this.pos);
        if (nl !== -1) {
          while (nl !== -1) {
            const cs = this.continueScalar(nl + 1);
            if (cs === -1)
              break;
            nl = qb.indexOf("\n", cs);
          }
          if (nl !== -1) {
            end = nl - (qb[nl - 1] === "\r" ? 2 : 1);
          }
        }
        if (end === -1) {
          if (!this.atEnd)
            return this.setNext("quoted-scalar");
          end = this.buffer.length;
        }
        yield* this.pushToIndex(end + 1, false);
        return this.flowLevel ? "flow" : "doc";
      }
      *parseBlockScalarHeader() {
        this.blockScalarIndent = -1;
        this.blockScalarKeep = false;
        let i = this.pos;
        while (true) {
          const ch = this.buffer[++i];
          if (ch === "+")
            this.blockScalarKeep = true;
          else if (ch > "0" && ch <= "9")
            this.blockScalarIndent = Number(ch) - 1;
          else if (ch !== "-")
            break;
        }
        return yield* this.pushUntil((ch) => isEmpty(ch) || ch === "#");
      }
      *parseBlockScalar() {
        let nl = this.pos - 1;
        let indent = 0;
        let ch;
        loop: for (let i2 = this.pos; ch = this.buffer[i2]; ++i2) {
          switch (ch) {
            case " ":
              indent += 1;
              break;
            case "\n":
              nl = i2;
              indent = 0;
              break;
            case "\r": {
              const next = this.buffer[i2 + 1];
              if (!next && !this.atEnd)
                return this.setNext("block-scalar");
              if (next === "\n")
                break;
            }
            // fallthrough
            default:
              break loop;
          }
        }
        if (!ch && !this.atEnd)
          return this.setNext("block-scalar");
        if (indent >= this.indentNext) {
          if (this.blockScalarIndent === -1)
            this.indentNext = indent;
          else {
            this.indentNext = this.blockScalarIndent + (this.indentNext === 0 ? 1 : this.indentNext);
          }
          do {
            const cs = this.continueScalar(nl + 1);
            if (cs === -1)
              break;
            nl = this.buffer.indexOf("\n", cs);
          } while (nl !== -1);
          if (nl === -1) {
            if (!this.atEnd)
              return this.setNext("block-scalar");
            nl = this.buffer.length;
          }
        }
        let i = nl + 1;
        ch = this.buffer[i];
        while (ch === " ")
          ch = this.buffer[++i];
        if (ch === "	") {
          while (ch === "	" || ch === " " || ch === "\r" || ch === "\n")
            ch = this.buffer[++i];
          nl = i - 1;
        } else if (!this.blockScalarKeep) {
          do {
            let i2 = nl - 1;
            let ch2 = this.buffer[i2];
            if (ch2 === "\r")
              ch2 = this.buffer[--i2];
            const lastChar = i2;
            while (ch2 === " ")
              ch2 = this.buffer[--i2];
            if (ch2 === "\n" && i2 >= this.pos && i2 + 1 + indent > lastChar)
              nl = i2;
            else
              break;
          } while (true);
        }
        yield cst.SCALAR;
        yield* this.pushToIndex(nl + 1, true);
        return yield* this.parseLineStart();
      }
      *parsePlainScalar() {
        const inFlow = this.flowLevel > 0;
        let end = this.pos - 1;
        let i = this.pos - 1;
        let ch;
        while (ch = this.buffer[++i]) {
          if (ch === ":") {
            const next = this.buffer[i + 1];
            if (isEmpty(next) || inFlow && flowIndicatorChars.has(next))
              break;
            end = i;
          } else if (isEmpty(ch)) {
            let next = this.buffer[i + 1];
            if (ch === "\r") {
              if (next === "\n") {
                i += 1;
                ch = "\n";
                next = this.buffer[i + 1];
              } else
                end = i;
            }
            if (next === "#" || inFlow && flowIndicatorChars.has(next))
              break;
            if (ch === "\n") {
              const cs = this.continueScalar(i + 1);
              if (cs === -1)
                break;
              i = Math.max(i, cs - 2);
            }
          } else {
            if (inFlow && flowIndicatorChars.has(ch))
              break;
            end = i;
          }
        }
        if (!ch && !this.atEnd)
          return this.setNext("plain-scalar");
        yield cst.SCALAR;
        yield* this.pushToIndex(end + 1, true);
        return inFlow ? "flow" : "doc";
      }
      *pushCount(n) {
        if (n > 0) {
          yield this.buffer.substr(this.pos, n);
          this.pos += n;
          return n;
        }
        return 0;
      }
      *pushToIndex(i, allowEmpty) {
        const s = this.buffer.slice(this.pos, i);
        if (s) {
          yield s;
          this.pos += s.length;
          return s.length;
        } else if (allowEmpty)
          yield "";
        return 0;
      }
      *pushIndicators() {
        let n = 0;
        loop: while (true) {
          switch (this.charAt(0)) {
            case "!":
              n += yield* this.pushTag();
              n += yield* this.pushSpaces(true);
              continue loop;
            case "&":
              n += yield* this.pushUntil(isNotAnchorChar);
              n += yield* this.pushSpaces(true);
              continue loop;
            case "-":
            // this is an error
            case "?":
            // this is an error outside flow collections
            case ":": {
              const inFlow = this.flowLevel > 0;
              const ch1 = this.charAt(1);
              if (isEmpty(ch1) || inFlow && flowIndicatorChars.has(ch1)) {
                if (!inFlow)
                  this.indentNext = this.indentValue + 1;
                else if (this.flowKey)
                  this.flowKey = false;
                n += yield* this.pushCount(1);
                n += yield* this.pushSpaces(true);
                continue loop;
              }
            }
          }
          break loop;
        }
        return n;
      }
      *pushTag() {
        if (this.charAt(1) === "<") {
          let i = this.pos + 2;
          let ch = this.buffer[i];
          while (!isEmpty(ch) && ch !== ">")
            ch = this.buffer[++i];
          return yield* this.pushToIndex(ch === ">" ? i + 1 : i, false);
        } else {
          let i = this.pos + 1;
          let ch = this.buffer[i];
          while (ch) {
            if (tagChars.has(ch))
              ch = this.buffer[++i];
            else if (ch === "%" && hexDigits.has(this.buffer[i + 1]) && hexDigits.has(this.buffer[i + 2])) {
              ch = this.buffer[i += 3];
            } else
              break;
          }
          return yield* this.pushToIndex(i, false);
        }
      }
      *pushNewline() {
        const ch = this.buffer[this.pos];
        if (ch === "\n")
          return yield* this.pushCount(1);
        else if (ch === "\r" && this.charAt(1) === "\n")
          return yield* this.pushCount(2);
        else
          return 0;
      }
      *pushSpaces(allowTabs) {
        let i = this.pos - 1;
        let ch;
        do {
          ch = this.buffer[++i];
        } while (ch === " " || allowTabs && ch === "	");
        const n = i - this.pos;
        if (n > 0) {
          yield this.buffer.substr(this.pos, n);
          this.pos = i;
        }
        return n;
      }
      *pushUntil(test) {
        let i = this.pos;
        let ch = this.buffer[i];
        while (!test(ch))
          ch = this.buffer[++i];
        return yield* this.pushToIndex(i, false);
      }
    };
    exports.Lexer = Lexer;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/line-counter.js
var require_line_counter = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/line-counter.js"(exports) {
    "use strict";
    var LineCounter2 = class {
      constructor() {
        this.lineStarts = [];
        this.addNewLine = (offset) => this.lineStarts.push(offset);
        this.linePos = (offset) => {
          let low = 0;
          let high = this.lineStarts.length;
          while (low < high) {
            const mid = low + high >> 1;
            if (this.lineStarts[mid] < offset)
              low = mid + 1;
            else
              high = mid;
          }
          if (this.lineStarts[low] === offset)
            return { line: low + 1, col: 1 };
          if (low === 0)
            return { line: 0, col: offset };
          const start = this.lineStarts[low - 1];
          return { line: low, col: offset - start + 1 };
        };
      }
    };
    exports.LineCounter = LineCounter2;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/parser.js
var require_parser = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/parser.js"(exports) {
    "use strict";
    var node_process = __require("process");
    var cst = require_cst();
    var lexer = require_lexer();
    function includesToken(list, type) {
      for (let i = 0; i < list.length; ++i)
        if (list[i].type === type)
          return true;
      return false;
    }
    function findNonEmptyIndex(list) {
      for (let i = 0; i < list.length; ++i) {
        switch (list[i].type) {
          case "space":
          case "comment":
          case "newline":
            break;
          default:
            return i;
        }
      }
      return -1;
    }
    function isFlowToken(token) {
      switch (token?.type) {
        case "alias":
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
        case "flow-collection":
          return true;
        default:
          return false;
      }
    }
    function getPrevProps(parent) {
      switch (parent.type) {
        case "document":
          return parent.start;
        case "block-map": {
          const it = parent.items[parent.items.length - 1];
          return it.sep ?? it.start;
        }
        case "block-seq":
          return parent.items[parent.items.length - 1].start;
        /* istanbul ignore next should not happen */
        default:
          return [];
      }
    }
    function getFirstKeyStartProps(prev) {
      if (prev.length === 0)
        return [];
      let i = prev.length;
      loop: while (--i >= 0) {
        switch (prev[i].type) {
          case "doc-start":
          case "explicit-key-ind":
          case "map-value-ind":
          case "seq-item-ind":
          case "newline":
            break loop;
        }
      }
      while (prev[++i]?.type === "space") {
      }
      return prev.splice(i, prev.length);
    }
    function arrayPushArray(target, source) {
      if (source.length < 1e5)
        Array.prototype.push.apply(target, source);
      else
        for (let i = 0; i < source.length; ++i)
          target.push(source[i]);
    }
    function fixFlowSeqItems(fc) {
      if (fc.start.type === "flow-seq-start") {
        for (const it of fc.items) {
          if (it.sep && !it.value && !includesToken(it.start, "explicit-key-ind") && !includesToken(it.sep, "map-value-ind")) {
            if (it.key)
              it.value = it.key;
            delete it.key;
            if (isFlowToken(it.value)) {
              if (it.value.end)
                arrayPushArray(it.value.end, it.sep);
              else
                it.value.end = it.sep;
            } else
              arrayPushArray(it.start, it.sep);
            delete it.sep;
          }
        }
      }
    }
    var Parser = class {
      /**
       * @param onNewLine - If defined, called separately with the start position of
       *   each new line (in `parse()`, including the start of input).
       */
      constructor(onNewLine) {
        this.atNewLine = true;
        this.atScalar = false;
        this.indent = 0;
        this.offset = 0;
        this.onKeyLine = false;
        this.stack = [];
        this.source = "";
        this.type = "";
        this.lexer = new lexer.Lexer();
        this.onNewLine = onNewLine;
      }
      /**
       * Parse `source` as a YAML stream.
       * If `incomplete`, a part of the last line may be left as a buffer for the next call.
       *
       * Errors are not thrown, but yielded as `{ type: 'error', message }` tokens.
       *
       * @returns A generator of tokens representing each directive, document, and other structure.
       */
      *parse(source, incomplete = false) {
        if (this.onNewLine && this.offset === 0)
          this.onNewLine(0);
        for (const lexeme of this.lexer.lex(source, incomplete))
          yield* this.next(lexeme);
        if (!incomplete)
          yield* this.end();
      }
      /**
       * Advance the parser by the `source` of one lexical token.
       */
      *next(source) {
        this.source = source;
        if (node_process.env.LOG_TOKENS)
          console.log("|", cst.prettyToken(source));
        if (this.atScalar) {
          this.atScalar = false;
          yield* this.step();
          this.offset += source.length;
          return;
        }
        const type = cst.tokenType(source);
        if (!type) {
          const message = `Not a YAML token: ${source}`;
          yield* this.pop({ type: "error", offset: this.offset, message, source });
          this.offset += source.length;
        } else if (type === "scalar") {
          this.atNewLine = false;
          this.atScalar = true;
          this.type = "scalar";
        } else {
          this.type = type;
          yield* this.step();
          switch (type) {
            case "newline":
              this.atNewLine = true;
              this.indent = 0;
              if (this.onNewLine)
                this.onNewLine(this.offset + source.length);
              break;
            case "space":
              if (this.atNewLine && source[0] === " ")
                this.indent += source.length;
              break;
            case "explicit-key-ind":
            case "map-value-ind":
            case "seq-item-ind":
              if (this.atNewLine)
                this.indent += source.length;
              break;
            case "doc-mode":
            case "flow-error-end":
              return;
            default:
              this.atNewLine = false;
          }
          this.offset += source.length;
        }
      }
      /** Call at end of input to push out any remaining constructions */
      *end() {
        while (this.stack.length > 0)
          yield* this.pop();
      }
      get sourceToken() {
        const st = {
          type: this.type,
          offset: this.offset,
          indent: this.indent,
          source: this.source
        };
        return st;
      }
      *step() {
        const top = this.peek(1);
        if (this.type === "doc-end" && top?.type !== "doc-end") {
          while (this.stack.length > 0)
            yield* this.pop();
          this.stack.push({
            type: "doc-end",
            offset: this.offset,
            source: this.source
          });
          return;
        }
        if (!top)
          return yield* this.stream();
        switch (top.type) {
          case "document":
            return yield* this.document(top);
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return yield* this.scalar(top);
          case "block-scalar":
            return yield* this.blockScalar(top);
          case "block-map":
            return yield* this.blockMap(top);
          case "block-seq":
            return yield* this.blockSequence(top);
          case "flow-collection":
            return yield* this.flowCollection(top);
          case "doc-end":
            return yield* this.documentEnd(top);
        }
        yield* this.pop();
      }
      peek(n) {
        return this.stack[this.stack.length - n];
      }
      *pop(error) {
        const token = error ?? this.stack.pop();
        if (!token) {
          const message = "Tried to pop an empty stack";
          yield { type: "error", offset: this.offset, source: "", message };
        } else if (this.stack.length === 0) {
          yield token;
        } else {
          const top = this.peek(1);
          if (token.type === "block-scalar") {
            token.indent = "indent" in top ? top.indent : 0;
          } else if (token.type === "flow-collection" && top.type === "document") {
            token.indent = 0;
          }
          if (token.type === "flow-collection")
            fixFlowSeqItems(token);
          switch (top.type) {
            case "document":
              top.value = token;
              break;
            case "block-scalar":
              top.props.push(token);
              break;
            case "block-map": {
              const it = top.items[top.items.length - 1];
              if (it.value) {
                top.items.push({ start: [], key: token, sep: [] });
                this.onKeyLine = true;
                return;
              } else if (it.sep) {
                it.value = token;
              } else {
                Object.assign(it, { key: token, sep: [] });
                this.onKeyLine = !it.explicitKey;
                return;
              }
              break;
            }
            case "block-seq": {
              const it = top.items[top.items.length - 1];
              if (it.value)
                top.items.push({ start: [], value: token });
              else
                it.value = token;
              break;
            }
            case "flow-collection": {
              const it = top.items[top.items.length - 1];
              if (!it || it.value)
                top.items.push({ start: [], key: token, sep: [] });
              else if (it.sep)
                it.value = token;
              else
                Object.assign(it, { key: token, sep: [] });
              return;
            }
            /* istanbul ignore next should not happen */
            default:
              yield* this.pop();
              yield* this.pop(token);
          }
          if ((top.type === "document" || top.type === "block-map" || top.type === "block-seq") && (token.type === "block-map" || token.type === "block-seq")) {
            const last = token.items[token.items.length - 1];
            if (last && !last.sep && !last.value && last.start.length > 0 && findNonEmptyIndex(last.start) === -1 && (token.indent === 0 || last.start.every((st) => st.type !== "comment" || st.indent < token.indent))) {
              if (top.type === "document")
                top.end = last.start;
              else
                top.items.push({ start: last.start });
              token.items.splice(-1, 1);
            }
          }
        }
      }
      *stream() {
        switch (this.type) {
          case "directive-line":
            yield { type: "directive", offset: this.offset, source: this.source };
            return;
          case "byte-order-mark":
          case "space":
          case "comment":
          case "newline":
            yield this.sourceToken;
            return;
          case "doc-mode":
          case "doc-start": {
            const doc = {
              type: "document",
              offset: this.offset,
              start: []
            };
            if (this.type === "doc-start")
              doc.start.push(this.sourceToken);
            this.stack.push(doc);
            return;
          }
        }
        yield {
          type: "error",
          offset: this.offset,
          message: `Unexpected ${this.type} token in YAML stream`,
          source: this.source
        };
      }
      *document(doc) {
        if (doc.value)
          return yield* this.lineEnd(doc);
        switch (this.type) {
          case "doc-start": {
            if (findNonEmptyIndex(doc.start) !== -1) {
              yield* this.pop();
              yield* this.step();
            } else
              doc.start.push(this.sourceToken);
            return;
          }
          case "anchor":
          case "tag":
          case "space":
          case "comment":
          case "newline":
            doc.start.push(this.sourceToken);
            return;
        }
        const bv = this.startBlockValue(doc);
        if (bv)
          this.stack.push(bv);
        else {
          yield {
            type: "error",
            offset: this.offset,
            message: `Unexpected ${this.type} token in YAML document`,
            source: this.source
          };
        }
      }
      *scalar(scalar) {
        if (this.type === "map-value-ind") {
          const prev = getPrevProps(this.peek(2));
          const start = getFirstKeyStartProps(prev);
          let sep3;
          if (scalar.end) {
            sep3 = scalar.end;
            sep3.push(this.sourceToken);
            delete scalar.end;
          } else
            sep3 = [this.sourceToken];
          const map = {
            type: "block-map",
            offset: scalar.offset,
            indent: scalar.indent,
            items: [{ start, key: scalar, sep: sep3 }]
          };
          this.onKeyLine = true;
          this.stack[this.stack.length - 1] = map;
        } else
          yield* this.lineEnd(scalar);
      }
      *blockScalar(scalar) {
        switch (this.type) {
          case "space":
          case "comment":
          case "newline":
            scalar.props.push(this.sourceToken);
            return;
          case "scalar":
            scalar.source = this.source;
            this.atNewLine = true;
            this.indent = 0;
            if (this.onNewLine) {
              let nl = this.source.indexOf("\n") + 1;
              while (nl !== 0) {
                this.onNewLine(this.offset + nl);
                nl = this.source.indexOf("\n", nl) + 1;
              }
            }
            yield* this.pop();
            break;
          /* istanbul ignore next should not happen */
          default:
            yield* this.pop();
            yield* this.step();
        }
      }
      *blockMap(map) {
        const it = map.items[map.items.length - 1];
        switch (this.type) {
          case "newline":
            this.onKeyLine = false;
            if (it.value) {
              const end = "end" in it.value ? it.value.end : void 0;
              const last = Array.isArray(end) ? end[end.length - 1] : void 0;
              if (last?.type === "comment")
                end?.push(this.sourceToken);
              else
                map.items.push({ start: [this.sourceToken] });
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              it.start.push(this.sourceToken);
            }
            return;
          case "space":
          case "comment":
            if (it.value) {
              map.items.push({ start: [this.sourceToken] });
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              if (this.atIndentedComment(it.start, map.indent)) {
                const prev = map.items[map.items.length - 2];
                const end = prev?.value?.end;
                if (Array.isArray(end)) {
                  arrayPushArray(end, it.start);
                  end.push(this.sourceToken);
                  map.items.pop();
                  return;
                }
              }
              it.start.push(this.sourceToken);
            }
            return;
        }
        if (this.indent >= map.indent) {
          const atMapIndent = !this.onKeyLine && this.indent === map.indent;
          const atNextItem = atMapIndent && (it.sep || it.explicitKey) && this.type !== "seq-item-ind";
          let start = [];
          if (atNextItem && it.sep && !it.value) {
            const nl = [];
            for (let i = 0; i < it.sep.length; ++i) {
              const st = it.sep[i];
              switch (st.type) {
                case "newline":
                  nl.push(i);
                  break;
                case "space":
                  break;
                case "comment":
                  if (st.indent > map.indent)
                    nl.length = 0;
                  break;
                default:
                  nl.length = 0;
              }
            }
            if (nl.length >= 2)
              start = it.sep.splice(nl[1]);
          }
          switch (this.type) {
            case "anchor":
            case "tag":
              if (atNextItem || it.value) {
                start.push(this.sourceToken);
                map.items.push({ start });
                this.onKeyLine = true;
              } else if (it.sep) {
                it.sep.push(this.sourceToken);
              } else {
                it.start.push(this.sourceToken);
              }
              return;
            case "explicit-key-ind":
              if (!it.sep && !it.explicitKey) {
                it.start.push(this.sourceToken);
                it.explicitKey = true;
              } else if (atNextItem || it.value) {
                start.push(this.sourceToken);
                map.items.push({ start, explicitKey: true });
              } else {
                this.stack.push({
                  type: "block-map",
                  offset: this.offset,
                  indent: this.indent,
                  items: [{ start: [this.sourceToken], explicitKey: true }]
                });
              }
              this.onKeyLine = true;
              return;
            case "map-value-ind":
              if (it.explicitKey) {
                if (!it.sep) {
                  if (includesToken(it.start, "newline")) {
                    Object.assign(it, { key: null, sep: [this.sourceToken] });
                  } else {
                    const start2 = getFirstKeyStartProps(it.start);
                    this.stack.push({
                      type: "block-map",
                      offset: this.offset,
                      indent: this.indent,
                      items: [{ start: start2, key: null, sep: [this.sourceToken] }]
                    });
                  }
                } else if (it.value) {
                  map.items.push({ start: [], key: null, sep: [this.sourceToken] });
                } else if (includesToken(it.sep, "map-value-ind")) {
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start, key: null, sep: [this.sourceToken] }]
                  });
                } else if (isFlowToken(it.key) && !includesToken(it.sep, "newline")) {
                  const start2 = getFirstKeyStartProps(it.start);
                  const key = it.key;
                  const sep3 = it.sep;
                  sep3.push(this.sourceToken);
                  delete it.key;
                  delete it.sep;
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: start2, key, sep: sep3 }]
                  });
                } else if (start.length > 0) {
                  it.sep = it.sep.concat(start, this.sourceToken);
                } else {
                  it.sep.push(this.sourceToken);
                }
              } else {
                if (!it.sep) {
                  Object.assign(it, { key: null, sep: [this.sourceToken] });
                } else if (it.value || atNextItem) {
                  map.items.push({ start, key: null, sep: [this.sourceToken] });
                } else if (includesToken(it.sep, "map-value-ind")) {
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: [], key: null, sep: [this.sourceToken] }]
                  });
                } else {
                  it.sep.push(this.sourceToken);
                }
              }
              this.onKeyLine = true;
              return;
            case "alias":
            case "scalar":
            case "single-quoted-scalar":
            case "double-quoted-scalar": {
              const fs2 = this.flowScalar(this.type);
              if (atNextItem || it.value) {
                map.items.push({ start, key: fs2, sep: [] });
                this.onKeyLine = true;
              } else if (it.sep) {
                this.stack.push(fs2);
              } else {
                Object.assign(it, { key: fs2, sep: [] });
                this.onKeyLine = true;
              }
              return;
            }
            default: {
              const bv = this.startBlockValue(map);
              if (bv) {
                if (bv.type === "block-seq") {
                  if (!it.explicitKey && it.sep && !includesToken(it.sep, "newline")) {
                    yield* this.pop({
                      type: "error",
                      offset: this.offset,
                      message: "Unexpected block-seq-ind on same line with key",
                      source: this.source
                    });
                    return;
                  }
                } else if (atMapIndent) {
                  map.items.push({ start });
                }
                this.stack.push(bv);
                return;
              }
            }
          }
        }
        yield* this.pop();
        yield* this.step();
      }
      *blockSequence(seq) {
        const it = seq.items[seq.items.length - 1];
        switch (this.type) {
          case "newline":
            if (it.value) {
              const end = "end" in it.value ? it.value.end : void 0;
              const last = Array.isArray(end) ? end[end.length - 1] : void 0;
              if (last?.type === "comment")
                end?.push(this.sourceToken);
              else
                seq.items.push({ start: [this.sourceToken] });
            } else
              it.start.push(this.sourceToken);
            return;
          case "space":
          case "comment":
            if (it.value)
              seq.items.push({ start: [this.sourceToken] });
            else {
              if (this.atIndentedComment(it.start, seq.indent)) {
                const prev = seq.items[seq.items.length - 2];
                const end = prev?.value?.end;
                if (Array.isArray(end)) {
                  arrayPushArray(end, it.start);
                  end.push(this.sourceToken);
                  seq.items.pop();
                  return;
                }
              }
              it.start.push(this.sourceToken);
            }
            return;
          case "anchor":
          case "tag":
            if (it.value || this.indent <= seq.indent)
              break;
            it.start.push(this.sourceToken);
            return;
          case "seq-item-ind":
            if (this.indent !== seq.indent)
              break;
            if (it.value || includesToken(it.start, "seq-item-ind"))
              seq.items.push({ start: [this.sourceToken] });
            else
              it.start.push(this.sourceToken);
            return;
        }
        if (this.indent > seq.indent) {
          const bv = this.startBlockValue(seq);
          if (bv) {
            this.stack.push(bv);
            return;
          }
        }
        yield* this.pop();
        yield* this.step();
      }
      *flowCollection(fc) {
        const it = fc.items[fc.items.length - 1];
        if (this.type === "flow-error-end") {
          let top;
          do {
            yield* this.pop();
            top = this.peek(1);
          } while (top?.type === "flow-collection");
        } else if (fc.end.length === 0) {
          switch (this.type) {
            case "comma":
            case "explicit-key-ind":
              if (!it || it.sep)
                fc.items.push({ start: [this.sourceToken] });
              else
                it.start.push(this.sourceToken);
              return;
            case "map-value-ind":
              if (!it || it.value)
                fc.items.push({ start: [], key: null, sep: [this.sourceToken] });
              else if (it.sep)
                it.sep.push(this.sourceToken);
              else
                Object.assign(it, { key: null, sep: [this.sourceToken] });
              return;
            case "space":
            case "comment":
            case "newline":
            case "anchor":
            case "tag":
              if (!it || it.value)
                fc.items.push({ start: [this.sourceToken] });
              else if (it.sep)
                it.sep.push(this.sourceToken);
              else
                it.start.push(this.sourceToken);
              return;
            case "alias":
            case "scalar":
            case "single-quoted-scalar":
            case "double-quoted-scalar": {
              const fs2 = this.flowScalar(this.type);
              if (!it || it.value)
                fc.items.push({ start: [], key: fs2, sep: [] });
              else if (it.sep)
                this.stack.push(fs2);
              else
                Object.assign(it, { key: fs2, sep: [] });
              return;
            }
            case "flow-map-end":
            case "flow-seq-end":
              fc.end.push(this.sourceToken);
              return;
          }
          const bv = this.startBlockValue(fc);
          if (bv)
            this.stack.push(bv);
          else {
            yield* this.pop();
            yield* this.step();
          }
        } else {
          const parent = this.peek(2);
          if (parent.type === "block-map" && (this.type === "map-value-ind" && parent.indent === fc.indent || this.type === "newline" && !parent.items[parent.items.length - 1].sep)) {
            yield* this.pop();
            yield* this.step();
          } else if (this.type === "map-value-ind" && parent.type !== "flow-collection") {
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            fixFlowSeqItems(fc);
            const sep3 = fc.end.splice(1, fc.end.length);
            sep3.push(this.sourceToken);
            const map = {
              type: "block-map",
              offset: fc.offset,
              indent: fc.indent,
              items: [{ start, key: fc, sep: sep3 }]
            };
            this.onKeyLine = true;
            this.stack[this.stack.length - 1] = map;
          } else {
            yield* this.lineEnd(fc);
          }
        }
      }
      flowScalar(type) {
        if (this.onNewLine) {
          let nl = this.source.indexOf("\n") + 1;
          while (nl !== 0) {
            this.onNewLine(this.offset + nl);
            nl = this.source.indexOf("\n", nl) + 1;
          }
        }
        return {
          type,
          offset: this.offset,
          indent: this.indent,
          source: this.source
        };
      }
      startBlockValue(parent) {
        switch (this.type) {
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return this.flowScalar(this.type);
          case "block-scalar-header":
            return {
              type: "block-scalar",
              offset: this.offset,
              indent: this.indent,
              props: [this.sourceToken],
              source: ""
            };
          case "flow-map-start":
          case "flow-seq-start":
            return {
              type: "flow-collection",
              offset: this.offset,
              indent: this.indent,
              start: this.sourceToken,
              items: [],
              end: []
            };
          case "seq-item-ind":
            return {
              type: "block-seq",
              offset: this.offset,
              indent: this.indent,
              items: [{ start: [this.sourceToken] }]
            };
          case "explicit-key-ind": {
            this.onKeyLine = true;
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            start.push(this.sourceToken);
            return {
              type: "block-map",
              offset: this.offset,
              indent: this.indent,
              items: [{ start, explicitKey: true }]
            };
          }
          case "map-value-ind": {
            this.onKeyLine = true;
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            return {
              type: "block-map",
              offset: this.offset,
              indent: this.indent,
              items: [{ start, key: null, sep: [this.sourceToken] }]
            };
          }
        }
        return null;
      }
      atIndentedComment(start, indent) {
        if (this.type !== "comment")
          return false;
        if (this.indent <= indent)
          return false;
        return start.every((st) => st.type === "newline" || st.type === "space");
      }
      *documentEnd(docEnd) {
        if (this.type !== "doc-mode") {
          if (docEnd.end)
            docEnd.end.push(this.sourceToken);
          else
            docEnd.end = [this.sourceToken];
          if (this.type === "newline")
            yield* this.pop();
        }
      }
      *lineEnd(token) {
        switch (this.type) {
          case "comma":
          case "doc-start":
          case "doc-end":
          case "flow-seq-end":
          case "flow-map-end":
          case "map-value-ind":
            yield* this.pop();
            yield* this.step();
            break;
          case "newline":
            this.onKeyLine = false;
          // fallthrough
          case "space":
          case "comment":
          default:
            if (token.end)
              token.end.push(this.sourceToken);
            else
              token.end = [this.sourceToken];
            if (this.type === "newline")
              yield* this.pop();
        }
      }
    };
    exports.Parser = Parser;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/public-api.js
var require_public_api = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/public-api.js"(exports) {
    "use strict";
    var composer = require_composer();
    var Document = require_Document();
    var errors = require_errors();
    var log = require_log();
    var identity = require_identity();
    var lineCounter = require_line_counter();
    var parser = require_parser();
    function parseOptions(options) {
      const prettyErrors = options.prettyErrors !== false;
      const lineCounter$1 = options.lineCounter || prettyErrors && new lineCounter.LineCounter() || null;
      return { lineCounter: lineCounter$1, prettyErrors };
    }
    function parseAllDocuments(source, options = {}) {
      const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
      const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
      const composer$1 = new composer.Composer(options);
      const docs = Array.from(composer$1.compose(parser$1.parse(source)));
      if (prettyErrors && lineCounter2)
        for (const doc of docs) {
          doc.errors.forEach(errors.prettifyError(source, lineCounter2));
          doc.warnings.forEach(errors.prettifyError(source, lineCounter2));
        }
      if (docs.length > 0)
        return docs;
      return Object.assign([], { empty: true }, composer$1.streamInfo());
    }
    function parseDocument(source, options = {}) {
      const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
      const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
      const composer$1 = new composer.Composer(options);
      let doc = null;
      for (const _doc of composer$1.compose(parser$1.parse(source), true, source.length)) {
        if (!doc)
          doc = _doc;
        else if (doc.options.logLevel !== "silent") {
          doc.errors.push(new errors.YAMLParseError(_doc.range.slice(0, 2), "MULTIPLE_DOCS", "Source contains multiple documents; please use YAML.parseAllDocuments()"));
          break;
        }
      }
      if (prettyErrors && lineCounter2) {
        doc.errors.forEach(errors.prettifyError(source, lineCounter2));
        doc.warnings.forEach(errors.prettifyError(source, lineCounter2));
      }
      return doc;
    }
    function parse(src, reviver, options) {
      let _reviver = void 0;
      if (typeof reviver === "function") {
        _reviver = reviver;
      } else if (options === void 0 && reviver && typeof reviver === "object") {
        options = reviver;
      }
      const doc = parseDocument(src, options);
      if (!doc)
        return null;
      doc.warnings.forEach((warning) => log.warn(doc.options.logLevel, warning));
      if (doc.errors.length > 0) {
        if (doc.options.logLevel !== "silent")
          throw doc.errors[0];
        else
          doc.errors = [];
      }
      return doc.toJS(Object.assign({ reviver: _reviver }, options));
    }
    function stringify(value, replacer, options) {
      let _replacer = null;
      if (typeof replacer === "function" || Array.isArray(replacer)) {
        _replacer = replacer;
      } else if (options === void 0 && replacer) {
        options = replacer;
      }
      if (typeof options === "string")
        options = options.length;
      if (typeof options === "number") {
        const indent = Math.round(options);
        options = indent < 1 ? void 0 : indent > 8 ? { indent: 8 } : { indent };
      }
      if (value === void 0) {
        const { keepUndefined } = options ?? replacer ?? {};
        if (!keepUndefined)
          return void 0;
      }
      if (identity.isDocument(value) && !_replacer)
        return value.toString(options);
      return new Document.Document(value, _replacer, options).toString(options);
    }
    exports.parse = parse;
    exports.parseAllDocuments = parseAllDocuments;
    exports.parseDocument = parseDocument;
    exports.stringify = stringify;
  }
});

// ../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/index.js
var require_dist = __commonJS({
  "../../node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/index.js"(exports) {
    "use strict";
    var composer = require_composer();
    var Document = require_Document();
    var Schema = require_Schema();
    var errors = require_errors();
    var Alias = require_Alias();
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var cst = require_cst();
    var lexer = require_lexer();
    var lineCounter = require_line_counter();
    var parser = require_parser();
    var publicApi = require_public_api();
    var visit = require_visit();
    exports.Composer = composer.Composer;
    exports.Document = Document.Document;
    exports.Schema = Schema.Schema;
    exports.YAMLError = errors.YAMLError;
    exports.YAMLParseError = errors.YAMLParseError;
    exports.YAMLWarning = errors.YAMLWarning;
    exports.Alias = Alias.Alias;
    exports.isAlias = identity.isAlias;
    exports.isCollection = identity.isCollection;
    exports.isDocument = identity.isDocument;
    exports.isMap = identity.isMap;
    exports.isNode = identity.isNode;
    exports.isPair = identity.isPair;
    exports.isScalar = identity.isScalar;
    exports.isSeq = identity.isSeq;
    exports.Pair = Pair.Pair;
    exports.Scalar = Scalar.Scalar;
    exports.YAMLMap = YAMLMap.YAMLMap;
    exports.YAMLSeq = YAMLSeq.YAMLSeq;
    exports.CST = cst;
    exports.Lexer = lexer.Lexer;
    exports.LineCounter = lineCounter.LineCounter;
    exports.Parser = parser.Parser;
    exports.parse = publicApi.parse;
    exports.parseAllDocuments = publicApi.parseAllDocuments;
    exports.parseDocument = publicApi.parseDocument;
    exports.stringify = publicApi.stringify;
    exports.visit = visit.visit;
    exports.visitAsync = visit.visitAsync;
  }
});

// ../../node_modules/.pnpm/picomatch@4.0.7/node_modules/picomatch/lib/constants.js
var require_constants = __commonJS({
  "../../node_modules/.pnpm/picomatch@4.0.7/node_modules/picomatch/lib/constants.js"(exports, module) {
    "use strict";
    var WIN_SLASH = "\\\\/";
    var WIN_NO_SLASH = `[^${WIN_SLASH}]`;
    var DEFAULT_MAX_EXTGLOB_RECURSION = 0;
    var DOT_LITERAL = "\\.";
    var PLUS_LITERAL = "\\+";
    var QMARK_LITERAL = "\\?";
    var SLASH_LITERAL = "\\/";
    var ONE_CHAR = "(?=.)";
    var QMARK = "[^/]";
    var END_ANCHOR = `(?:${SLASH_LITERAL}|$)`;
    var START_ANCHOR = `(?:^|${SLASH_LITERAL})`;
    var DOTS_SLASH = `${DOT_LITERAL}{1,2}${END_ANCHOR}`;
    var NO_DOT = `(?!${DOT_LITERAL})`;
    var NO_DOTS = `(?!${START_ANCHOR}${DOTS_SLASH})`;
    var NO_DOT_SLASH = `(?!${DOT_LITERAL}{0,1}${END_ANCHOR})`;
    var NO_DOTS_SLASH = `(?!${DOTS_SLASH})`;
    var QMARK_NO_DOT = `[^.${SLASH_LITERAL}]`;
    var STAR = `${QMARK}*?`;
    var SEP = "/";
    var POSIX_CHARS = {
      DOT_LITERAL,
      PLUS_LITERAL,
      QMARK_LITERAL,
      SLASH_LITERAL,
      ONE_CHAR,
      QMARK,
      END_ANCHOR,
      DOTS_SLASH,
      NO_DOT,
      NO_DOTS,
      NO_DOT_SLASH,
      NO_DOTS_SLASH,
      QMARK_NO_DOT,
      STAR,
      START_ANCHOR,
      SEP
    };
    var WINDOWS_CHARS = {
      ...POSIX_CHARS,
      SLASH_LITERAL: `[${WIN_SLASH}]`,
      QMARK: WIN_NO_SLASH,
      STAR: `${WIN_NO_SLASH}*?`,
      DOTS_SLASH: `${DOT_LITERAL}{1,2}(?:[${WIN_SLASH}]|$)`,
      NO_DOT: `(?!${DOT_LITERAL})`,
      NO_DOTS: `(?!(?:^|[${WIN_SLASH}])${DOT_LITERAL}{1,2}(?:[${WIN_SLASH}]|$))`,
      NO_DOT_SLASH: `(?!${DOT_LITERAL}{0,1}(?:[${WIN_SLASH}]|$))`,
      NO_DOTS_SLASH: `(?!${DOT_LITERAL}{1,2}(?:[${WIN_SLASH}]|$))`,
      QMARK_NO_DOT: `[^.${WIN_SLASH}]`,
      START_ANCHOR: `(?:^|[${WIN_SLASH}])`,
      END_ANCHOR: `(?:[${WIN_SLASH}]|$)`,
      SEP: "\\"
    };
    var POSIX_REGEX_SOURCE = {
      __proto__: null,
      alnum: "a-zA-Z0-9",
      alpha: "a-zA-Z",
      ascii: "\\x00-\\x7F",
      blank: " \\t",
      cntrl: "\\x00-\\x1F\\x7F",
      digit: "0-9",
      graph: "\\x21-\\x7E",
      lower: "a-z",
      print: "\\x20-\\x7E ",
      punct: "\\-!\"#$%&'()\\*+,./:;<=>?@[\\]^_`{|}~",
      space: " \\t\\r\\n\\v\\f",
      upper: "A-Z",
      word: "A-Za-z0-9_",
      xdigit: "A-Fa-f0-9"
    };
    module.exports = {
      DEFAULT_MAX_EXTGLOB_RECURSION,
      MAX_LENGTH: 1024 * 64,
      POSIX_REGEX_SOURCE,
      // regular expressions
      REGEX_BACKSLASH: /\\(?![*+?^${}(|)[\]])/g,
      REGEX_NON_SPECIAL_CHARS: /^[^@![\].,$*+?^{}()|\\/]+/,
      REGEX_SPECIAL_CHARS: /[-*+?.^${}(|)[\]]/,
      REGEX_SPECIAL_CHARS_BACKREF: /(\\?)((\W)(\3*))/g,
      REGEX_SPECIAL_CHARS_GLOBAL: /([-*+?.^${}(|)[\]])/g,
      REGEX_REMOVE_BACKSLASH: /(?:\[.*?[^\\]\]|\\(?=.))/g,
      // Replace globs with equivalent patterns to reduce parsing time.
      REPLACEMENTS: {
        __proto__: null,
        "***": "*",
        "**/**": "**",
        "**/**/**": "**"
      },
      // Digits
      CHAR_0: 48,
      /* 0 */
      CHAR_9: 57,
      /* 9 */
      // Alphabet chars.
      CHAR_UPPERCASE_A: 65,
      /* A */
      CHAR_LOWERCASE_A: 97,
      /* a */
      CHAR_UPPERCASE_Z: 90,
      /* Z */
      CHAR_LOWERCASE_Z: 122,
      /* z */
      CHAR_LEFT_PARENTHESES: 40,
      /* ( */
      CHAR_RIGHT_PARENTHESES: 41,
      /* ) */
      CHAR_ASTERISK: 42,
      /* * */
      // Non-alphabetic chars.
      CHAR_AMPERSAND: 38,
      /* & */
      CHAR_AT: 64,
      /* @ */
      CHAR_BACKWARD_SLASH: 92,
      /* \ */
      CHAR_CARRIAGE_RETURN: 13,
      /* \r */
      CHAR_CIRCUMFLEX_ACCENT: 94,
      /* ^ */
      CHAR_COLON: 58,
      /* : */
      CHAR_COMMA: 44,
      /* , */
      CHAR_DOT: 46,
      /* . */
      CHAR_DOUBLE_QUOTE: 34,
      /* " */
      CHAR_EQUAL: 61,
      /* = */
      CHAR_EXCLAMATION_MARK: 33,
      /* ! */
      CHAR_FORM_FEED: 12,
      /* \f */
      CHAR_FORWARD_SLASH: 47,
      /* / */
      CHAR_GRAVE_ACCENT: 96,
      /* ` */
      CHAR_HASH: 35,
      /* # */
      CHAR_HYPHEN_MINUS: 45,
      /* - */
      CHAR_LEFT_ANGLE_BRACKET: 60,
      /* < */
      CHAR_LEFT_CURLY_BRACE: 123,
      /* { */
      CHAR_LEFT_SQUARE_BRACKET: 91,
      /* [ */
      CHAR_LINE_FEED: 10,
      /* \n */
      CHAR_NO_BREAK_SPACE: 160,
      /* \u00A0 */
      CHAR_PERCENT: 37,
      /* % */
      CHAR_PLUS: 43,
      /* + */
      CHAR_QUESTION_MARK: 63,
      /* ? */
      CHAR_RIGHT_ANGLE_BRACKET: 62,
      /* > */
      CHAR_RIGHT_CURLY_BRACE: 125,
      /* } */
      CHAR_RIGHT_SQUARE_BRACKET: 93,
      /* ] */
      CHAR_SEMICOLON: 59,
      /* ; */
      CHAR_SINGLE_QUOTE: 39,
      /* ' */
      CHAR_SPACE: 32,
      /*   */
      CHAR_TAB: 9,
      /* \t */
      CHAR_UNDERSCORE: 95,
      /* _ */
      CHAR_VERTICAL_LINE: 124,
      /* | */
      CHAR_ZERO_WIDTH_NOBREAK_SPACE: 65279,
      /* \uFEFF */
      /**
       * Create EXTGLOB_CHARS
       */
      extglobChars(chars) {
        return {
          "!": { type: "negate", open: "(?:(?!(?:", close: `))${chars.STAR})` },
          "?": { type: "qmark", open: "(?:", close: ")?" },
          "+": { type: "plus", open: "(?:", close: ")+" },
          "*": { type: "star", open: "(?:", close: ")*" },
          "@": { type: "at", open: "(?:", close: ")" }
        };
      },
      /**
       * Create GLOB_CHARS
       */
      globChars(win32) {
        return win32 === true ? WINDOWS_CHARS : POSIX_CHARS;
      }
    };
  }
});

// ../../node_modules/.pnpm/picomatch@4.0.7/node_modules/picomatch/lib/utils.js
var require_utils = __commonJS({
  "../../node_modules/.pnpm/picomatch@4.0.7/node_modules/picomatch/lib/utils.js"(exports) {
    "use strict";
    var {
      REGEX_BACKSLASH,
      REGEX_REMOVE_BACKSLASH,
      REGEX_SPECIAL_CHARS,
      REGEX_SPECIAL_CHARS_GLOBAL
    } = require_constants();
    exports.isObject = (val) => val !== null && typeof val === "object" && !Array.isArray(val);
    exports.hasRegexChars = (str) => REGEX_SPECIAL_CHARS.test(str);
    exports.isRegexChar = (str) => str.length === 1 && exports.hasRegexChars(str);
    exports.escapeRegex = (str) => str.replace(REGEX_SPECIAL_CHARS_GLOBAL, "\\$1");
    exports.toPosixSlashes = (str) => str.replace(REGEX_BACKSLASH, "/");
    exports.isWindows = () => {
      if (typeof navigator !== "undefined" && navigator.platform) {
        const platform = navigator.platform.toLowerCase();
        return platform === "win32" || platform === "windows";
      }
      if (typeof process !== "undefined" && process.platform) {
        return process.platform === "win32";
      }
      return false;
    };
    exports.removeBackslashes = (str) => {
      return str.replace(REGEX_REMOVE_BACKSLASH, (match) => {
        return match === "\\" ? "" : match;
      });
    };
    exports.escapeLast = (input, char, lastIdx) => {
      const idx = input.lastIndexOf(char, lastIdx);
      if (idx === -1) return input;
      if (input[idx - 1] === "\\") return exports.escapeLast(input, char, idx - 1);
      return `${input.slice(0, idx)}\\${input.slice(idx)}`;
    };
    exports.removePrefix = (input, state = {}) => {
      let output = input;
      if (output.startsWith("./")) {
        output = output.slice(2);
        state.prefix = "./";
      }
      return output;
    };
    exports.wrapOutput = (input, state = {}, options = {}) => {
      const prepend = options.contains ? "" : "^";
      const append = options.contains ? "" : "$";
      let output = `${prepend}(?:${input})${append}`;
      if (state.negated === true) {
        output = `(?:^(?!${output}).*$)`;
      }
      return output;
    };
    exports.basename = (path2, { windows } = {}) => {
      const segs = path2.split(windows ? /[\\/]/ : "/");
      const last = segs[segs.length - 1];
      if (last === "") {
        return segs[segs.length - 2];
      }
      return last;
    };
  }
});

// ../../node_modules/.pnpm/picomatch@4.0.7/node_modules/picomatch/lib/scan.js
var require_scan = __commonJS({
  "../../node_modules/.pnpm/picomatch@4.0.7/node_modules/picomatch/lib/scan.js"(exports, module) {
    "use strict";
    var utils = require_utils();
    var {
      CHAR_ASTERISK,
      /* * */
      CHAR_AT,
      /* @ */
      CHAR_BACKWARD_SLASH,
      /* \ */
      CHAR_COMMA,
      /* , */
      CHAR_DOT,
      /* . */
      CHAR_EXCLAMATION_MARK,
      /* ! */
      CHAR_FORWARD_SLASH,
      /* / */
      CHAR_LEFT_CURLY_BRACE,
      /* { */
      CHAR_LEFT_PARENTHESES,
      /* ( */
      CHAR_LEFT_SQUARE_BRACKET,
      /* [ */
      CHAR_PLUS,
      /* + */
      CHAR_QUESTION_MARK,
      /* ? */
      CHAR_RIGHT_CURLY_BRACE,
      /* } */
      CHAR_RIGHT_PARENTHESES,
      /* ) */
      CHAR_RIGHT_SQUARE_BRACKET
      /* ] */
    } = require_constants();
    var isPathSeparator = (code) => {
      return code === CHAR_FORWARD_SLASH || code === CHAR_BACKWARD_SLASH;
    };
    var depth = (token) => {
      if (token.isPrefix !== true) {
        token.depth = token.isGlobstar ? Infinity : 1;
      }
    };
    var scan2 = (input, options) => {
      const opts = options || {};
      const length = input.length - 1;
      const scanToEnd = opts.parts === true || opts.tokens === true || opts.scanToEnd === true;
      const slashes = [];
      const tokens = [];
      const parts = [];
      let str = input;
      let index = -1;
      let start = 0;
      let lastIndex = 0;
      let isBrace = false;
      let isBracket = false;
      let isGlob = false;
      let isExtglob = false;
      let isGlobstar = false;
      let braceEscaped = false;
      let backslashes = false;
      let negated = false;
      let negatedExtglob = false;
      let finished = false;
      let braces = 0;
      let prev;
      let code;
      let token = { value: "", depth: 0, isGlob: false };
      const eos = () => index >= length;
      const peek = () => str.charCodeAt(index + 1);
      const advance = () => {
        prev = code;
        return str.charCodeAt(++index);
      };
      while (index < length) {
        code = advance();
        let next;
        if (code === CHAR_BACKWARD_SLASH) {
          backslashes = token.backslashes = true;
          code = advance();
          if (code === CHAR_LEFT_CURLY_BRACE) {
            braceEscaped = true;
          }
          continue;
        }
        if (braceEscaped === true || code === CHAR_LEFT_CURLY_BRACE) {
          braces++;
          while (eos() !== true && (code = advance())) {
            if (code === CHAR_BACKWARD_SLASH) {
              backslashes = token.backslashes = true;
              advance();
              continue;
            }
            if (code === CHAR_LEFT_CURLY_BRACE) {
              braces++;
              continue;
            }
            if (braceEscaped !== true && code === CHAR_DOT && (code = advance()) === CHAR_DOT) {
              isBrace = token.isBrace = true;
              isGlob = token.isGlob = true;
              finished = true;
              if (scanToEnd === true) {
                continue;
              }
              break;
            }
            if (braceEscaped !== true && code === CHAR_COMMA) {
              isBrace = token.isBrace = true;
              isGlob = token.isGlob = true;
              finished = true;
              if (scanToEnd === true) {
                continue;
              }
              break;
            }
            if (code === CHAR_RIGHT_CURLY_BRACE) {
              braces--;
              if (braces === 0) {
                braceEscaped = false;
                isBrace = token.isBrace = true;
                finished = true;
                break;
              }
            }
          }
          if (scanToEnd === true) {
            continue;
          }
          break;
        }
        if (code === CHAR_FORWARD_SLASH) {
          slashes.push(index);
          tokens.push(token);
          token = { value: "", depth: 0, isGlob: false };
          if (finished === true) continue;
          if (prev === CHAR_DOT && index === start + 1) {
            start += 2;
            continue;
          }
          lastIndex = index + 1;
          continue;
        }
        if (opts.noext !== true) {
          const isExtglobChar = code === CHAR_PLUS || code === CHAR_AT || code === CHAR_ASTERISK || code === CHAR_QUESTION_MARK || code === CHAR_EXCLAMATION_MARK;
          if (isExtglobChar === true && peek() === CHAR_LEFT_PARENTHESES) {
            isGlob = token.isGlob = true;
            isExtglob = token.isExtglob = true;
            finished = true;
            if (code === CHAR_EXCLAMATION_MARK && index === start) {
              negatedExtglob = true;
            }
            if (scanToEnd === true) {
              let parens = 0;
              while (eos() !== true && (code = advance())) {
                if (code === CHAR_BACKWARD_SLASH) {
                  backslashes = token.backslashes = true;
                  advance();
                  continue;
                }
                if (code === CHAR_LEFT_PARENTHESES) {
                  parens++;
                  continue;
                }
                if (code === CHAR_RIGHT_PARENTHESES && --parens === 0) {
                  finished = true;
                  break;
                }
              }
              continue;
            }
            break;
          }
        }
        if (code === CHAR_ASTERISK) {
          if (prev === CHAR_ASTERISK) isGlobstar = token.isGlobstar = true;
          isGlob = token.isGlob = true;
          finished = true;
          if (scanToEnd === true) {
            continue;
          }
          break;
        }
        if (code === CHAR_QUESTION_MARK) {
          isGlob = token.isGlob = true;
          finished = true;
          if (scanToEnd === true) {
            continue;
          }
          break;
        }
        if (code === CHAR_LEFT_SQUARE_BRACKET) {
          while (eos() !== true && (next = advance())) {
            if (next === CHAR_BACKWARD_SLASH) {
              backslashes = token.backslashes = true;
              advance();
              continue;
            }
            if (next === CHAR_RIGHT_SQUARE_BRACKET) {
              isBracket = token.isBracket = true;
              isGlob = token.isGlob = true;
              finished = true;
              break;
            }
          }
          if (scanToEnd === true) {
            continue;
          }
          break;
        }
        if (opts.nonegate !== true && code === CHAR_EXCLAMATION_MARK && index === start) {
          negated = token.negated = true;
          start++;
          continue;
        }
        if (opts.noparen !== true && code === CHAR_LEFT_PARENTHESES) {
          isGlob = token.isGlob = true;
          if (scanToEnd === true) {
            let parens = 1;
            while (eos() !== true && (code = advance())) {
              if (code === CHAR_BACKWARD_SLASH) {
                backslashes = token.backslashes = true;
                advance();
                continue;
              }
              if (code === CHAR_LEFT_PARENTHESES) {
                parens++;
                continue;
              }
              if (code === CHAR_RIGHT_PARENTHESES && --parens === 0) {
                finished = true;
                break;
              }
            }
            continue;
          }
          break;
        }
        if (isGlob === true) {
          finished = true;
          if (scanToEnd === true) {
            continue;
          }
          break;
        }
      }
      if (opts.noext === true) {
        isExtglob = false;
        isGlob = false;
      }
      let base = str;
      let prefix = "";
      let glob = "";
      if (start > 0) {
        prefix = str.slice(0, start);
        str = str.slice(start);
        lastIndex -= start;
      }
      if (base && isGlob === true && lastIndex > 0) {
        base = str.slice(0, lastIndex);
        glob = str.slice(lastIndex);
      } else if (isGlob === true) {
        base = "";
        glob = str;
      } else {
        base = str;
      }
      if (base && base !== "" && base !== "/" && base !== str) {
        if (isPathSeparator(base.charCodeAt(base.length - 1))) {
          base = base.slice(0, -1);
        }
      }
      if (opts.unescape === true) {
        if (glob) glob = utils.removeBackslashes(glob);
        if (base && backslashes === true) {
          base = utils.removeBackslashes(base);
        }
      }
      const state = {
        prefix,
        input,
        start,
        base,
        glob,
        isBrace,
        isBracket,
        isGlob,
        isExtglob,
        isGlobstar,
        negated,
        negatedExtglob
      };
      if (opts.tokens === true) {
        state.maxDepth = 0;
        if (!isPathSeparator(code)) {
          tokens.push(token);
        }
        state.tokens = tokens;
      }
      if (opts.parts === true || opts.tokens === true) {
        let prevIndex;
        for (let idx = 0; idx < slashes.length; idx++) {
          const n2 = prevIndex !== void 0 ? prevIndex + 1 : start;
          const i = slashes[idx];
          const value2 = input.slice(n2, i);
          if (opts.tokens) {
            if (idx === 0 && start !== 0) {
              tokens[idx].isPrefix = true;
              tokens[idx].value = prefix;
            } else {
              tokens[idx].value = value2;
            }
            depth(tokens[idx]);
            state.maxDepth += tokens[idx].depth;
          }
          if (i >= start) {
            parts.push(value2);
            prevIndex = i;
          }
        }
        const n = prevIndex !== void 0 ? prevIndex + 1 : start;
        const value = input.slice(n);
        parts.push(value);
        if (opts.tokens && prevIndex && prevIndex + 1 < input.length) {
          tokens[tokens.length - 1].value = value;
          depth(tokens[tokens.length - 1]);
          state.maxDepth += tokens[tokens.length - 1].depth;
        }
        state.slashes = slashes;
        state.parts = parts;
      }
      return state;
    };
    module.exports = scan2;
  }
});

// ../../node_modules/.pnpm/picomatch@4.0.7/node_modules/picomatch/lib/parse.js
var require_parse = __commonJS({
  "../../node_modules/.pnpm/picomatch@4.0.7/node_modules/picomatch/lib/parse.js"(exports, module) {
    "use strict";
    var constants = require_constants();
    var utils = require_utils();
    var {
      MAX_LENGTH,
      POSIX_REGEX_SOURCE,
      REGEX_NON_SPECIAL_CHARS,
      REGEX_SPECIAL_CHARS_BACKREF,
      REPLACEMENTS
    } = constants;
    var expandRange = (args, options) => {
      if (typeof options.expandRange === "function") {
        return options.expandRange(...args, options);
      }
      args.sort();
      const value = `[${args.join("-")}]`;
      try {
        new RegExp(value);
      } catch (ex) {
        return args.map((v) => utils.escapeRegex(v)).join("..");
      }
      return value;
    };
    var syntaxError = (type, char) => {
      return `Missing ${type}: "${char}" - use "\\\\${char}" to match literal characters`;
    };
    var splitTopLevel = (input) => {
      const parts = [];
      let bracket = 0;
      let paren = 0;
      let quote2 = 0;
      let value = "";
      let escaped = false;
      for (const ch of input) {
        if (escaped === true) {
          value += ch;
          escaped = false;
          continue;
        }
        if (ch === "\\") {
          value += ch;
          escaped = true;
          continue;
        }
        if (ch === '"') {
          quote2 = quote2 === 1 ? 0 : 1;
          value += ch;
          continue;
        }
        if (quote2 === 0) {
          if (ch === "[") {
            bracket++;
          } else if (ch === "]" && bracket > 0) {
            bracket--;
          } else if (bracket === 0) {
            if (ch === "(") {
              paren++;
            } else if (ch === ")" && paren > 0) {
              paren--;
            } else if (ch === "|" && paren === 0) {
              parts.push(value);
              value = "";
              continue;
            }
          }
        }
        value += ch;
      }
      parts.push(value);
      return parts;
    };
    var isPlainBranch = (branch) => {
      let escaped = false;
      for (const ch of branch) {
        if (escaped === true) {
          escaped = false;
          continue;
        }
        if (ch === "\\") {
          escaped = true;
          continue;
        }
        if (/[?*+@!()[\]{}]/.test(ch)) {
          return false;
        }
      }
      return true;
    };
    var normalizeSimpleBranch = (branch) => {
      let value = branch.trim();
      let changed = true;
      while (changed === true) {
        changed = false;
        if (/^@\([^\\()[\]{}|]+\)$/.test(value)) {
          value = value.slice(2, -1);
          changed = true;
        }
      }
      if (!isPlainBranch(value)) {
        return;
      }
      return value.replace(/\\(.)/g, "$1");
    };
    var hasRepeatedCharPrefixOverlap = (branches) => {
      const values = branches.map(normalizeSimpleBranch).filter(Boolean);
      for (let i = 0; i < values.length; i++) {
        for (let j = i + 1; j < values.length; j++) {
          const a = values[i];
          const b = values[j];
          const char = a[0];
          if (!char || a !== char.repeat(a.length) || b !== char.repeat(b.length)) {
            continue;
          }
          if (a === b || a.startsWith(b) || b.startsWith(a)) {
            return true;
          }
        }
      }
      return false;
    };
    var parseRepeatedExtglob = (pattern, requireEnd = true) => {
      if (pattern[0] !== "+" && pattern[0] !== "*" || pattern[1] !== "(") {
        return;
      }
      let bracket = 0;
      let paren = 0;
      let quote2 = 0;
      let escaped = false;
      for (let i = 1; i < pattern.length; i++) {
        const ch = pattern[i];
        if (escaped === true) {
          escaped = false;
          continue;
        }
        if (ch === "\\") {
          escaped = true;
          continue;
        }
        if (ch === '"') {
          quote2 = quote2 === 1 ? 0 : 1;
          continue;
        }
        if (quote2 === 1) {
          continue;
        }
        if (ch === "[") {
          bracket++;
          continue;
        }
        if (ch === "]" && bracket > 0) {
          bracket--;
          continue;
        }
        if (bracket > 0) {
          continue;
        }
        if (ch === "(") {
          paren++;
          continue;
        }
        if (ch === ")") {
          paren--;
          if (paren === 0) {
            if (requireEnd === true && i !== pattern.length - 1) {
              return;
            }
            return {
              type: pattern[0],
              body: pattern.slice(2, i),
              end: i
            };
          }
        }
      }
    };
    var buildCharClassStar = (chars) => {
      const source = chars.length === 1 ? utils.escapeRegex(chars[0]) : `[${chars.map((ch) => utils.escapeRegex(ch)).join("")}]`;
      return `${source}*`;
    };
    var getStarExtglobSequenceChars = (pattern) => {
      let index = 0;
      const chars = [];
      while (index < pattern.length) {
        const match = parseRepeatedExtglob(pattern.slice(index), false);
        if (!match || match.type !== "*") {
          return;
        }
        const branches = splitTopLevel(match.body).map((branch2) => branch2.trim());
        if (branches.length !== 1) {
          return;
        }
        const branch = normalizeSimpleBranch(branches[0]);
        if (!branch || branch.length !== 1) {
          return;
        }
        chars.push(branch);
        index += match.end + 1;
      }
      if (chars.length < 1) {
        return;
      }
      return chars;
    };
    var repeatedExtglobRecursion = (pattern) => {
      let depth = 0;
      let value = pattern.trim();
      let match = parseRepeatedExtglob(value);
      while (match) {
        depth++;
        value = match.body.trim();
        match = parseRepeatedExtglob(value);
      }
      return depth;
    };
    var analyzeRepeatedExtglob = (body, options) => {
      if (options.maxExtglobRecursion === false) {
        return { risky: false };
      }
      const max = typeof options.maxExtglobRecursion === "number" ? options.maxExtglobRecursion : constants.DEFAULT_MAX_EXTGLOB_RECURSION;
      const branches = splitTopLevel(body).map((branch) => branch.trim());
      if (branches.length > 1) {
        if (branches.some((branch) => branch === "") || branches.some((branch) => /^[*?]+$/.test(branch)) || hasRepeatedCharPrefixOverlap(branches)) {
          return { risky: true };
        }
      }
      const safeChars = [];
      let sawStarSequence = false;
      let combinable = true;
      for (const branch of branches) {
        const chars = getStarExtglobSequenceChars(branch);
        if (chars) {
          sawStarSequence = true;
          safeChars.push(...chars);
          continue;
        }
        const literal = normalizeSimpleBranch(branch);
        if (literal && literal.length === 1) {
          safeChars.push(literal);
          continue;
        }
        combinable = false;
        if (repeatedExtglobRecursion(branch) > max) {
          return { risky: true };
        }
      }
      if (sawStarSequence) {
        return combinable ? { risky: true, safeOutput: buildCharClassStar([...new Set(safeChars)]) } : { risky: true };
      }
      return { risky: false };
    };
    var parse = (input, options) => {
      if (typeof input !== "string") {
        throw new TypeError("Expected a string");
      }
      input = REPLACEMENTS[input] || input;
      const opts = { ...options };
      const max = typeof opts.maxLength === "number" ? Math.min(MAX_LENGTH, opts.maxLength) : MAX_LENGTH;
      let len = input.length;
      if (len > max) {
        throw new SyntaxError(`Input length: ${len}, exceeds maximum allowed length: ${max}`);
      }
      const bos = { type: "bos", value: "", output: opts.prepend || "" };
      const tokens = [bos];
      const capture = opts.capture ? "" : "?:";
      const PLATFORM_CHARS = constants.globChars(opts.windows);
      const EXTGLOB_CHARS = constants.extglobChars(PLATFORM_CHARS);
      const {
        DOT_LITERAL,
        PLUS_LITERAL,
        SLASH_LITERAL,
        ONE_CHAR,
        DOTS_SLASH,
        NO_DOT,
        NO_DOT_SLASH,
        NO_DOTS_SLASH,
        QMARK,
        QMARK_NO_DOT,
        STAR,
        START_ANCHOR
      } = PLATFORM_CHARS;
      const globstar = (opts2) => {
        return `(${capture}(?:(?!${START_ANCHOR}${opts2.dot ? DOTS_SLASH : DOT_LITERAL}).)*?)`;
      };
      const nodot = opts.dot ? "" : NO_DOT;
      const qmarkNoDot = opts.dot ? QMARK : QMARK_NO_DOT;
      let star = opts.bash === true ? globstar(opts) : STAR;
      if (opts.capture) {
        star = `(${star})`;
      }
      if (typeof opts.noext === "boolean") {
        opts.noextglob = opts.noext;
      }
      const state = {
        input,
        index: -1,
        start: 0,
        dot: opts.dot === true,
        consumed: "",
        output: "",
        prefix: "",
        backtrack: false,
        negated: false,
        brackets: 0,
        braces: 0,
        parens: 0,
        quotes: 0,
        globstar: false,
        tokens
      };
      input = utils.removePrefix(input, state);
      len = input.length;
      const extglobs = [];
      const braces = [];
      const stack = [];
      let prev = bos;
      let value;
      const eos = () => state.index === len - 1;
      const peek = state.peek = (n = 1) => input[state.index + n];
      const advance = state.advance = () => input[++state.index] || "";
      const remaining = () => input.slice(state.index + 1);
      const consume = (value2 = "", num = 0) => {
        state.consumed += value2;
        state.index += num;
      };
      const append = (token) => {
        state.output += token.output != null ? token.output : token.value;
        consume(token.value);
      };
      const negate = () => {
        let count = 1;
        while (peek() === "!" && (peek(2) !== "(" || peek(3) === "?")) {
          advance();
          state.start++;
          count++;
        }
        if (count % 2 === 0) {
          return false;
        }
        state.negated = true;
        state.start++;
        return true;
      };
      const increment = (type) => {
        state[type]++;
        stack.push(type);
      };
      const decrement = (type) => {
        state[type]--;
        stack.pop();
      };
      const push = (tok) => {
        if (prev.type === "globstar") {
          const isBrace = state.braces > 0 && (tok.type === "comma" || tok.type === "brace");
          const isExtglob = tok.extglob === true || extglobs.length && (tok.type === "pipe" || tok.type === "paren");
          if (tok.type !== "slash" && tok.type !== "paren" && !isBrace && !isExtglob) {
            state.output = state.output.slice(0, -prev.output.length);
            prev.type = "star";
            prev.value = "*";
            prev.output = star;
            state.output += prev.output;
          }
        }
        if (extglobs.length && tok.type !== "paren") {
          extglobs[extglobs.length - 1].inner += tok.value;
        }
        if (tok.value || tok.output) append(tok);
        if (prev && prev.type === "text" && tok.type === "text") {
          prev.output = (prev.output || prev.value) + tok.value;
          prev.value += tok.value;
          return;
        }
        tok.prev = prev;
        tokens.push(tok);
        prev = tok;
      };
      const extglobOpen = (type, value2) => {
        const token = { ...EXTGLOB_CHARS[value2], conditions: 1, inner: "" };
        token.prev = prev;
        token.parens = state.parens;
        token.output = state.output;
        token.startIndex = state.index;
        token.tokensIndex = tokens.length;
        const output = (opts.capture ? "(" : "") + token.open;
        increment("parens");
        push({ type, value: value2, output: state.output ? "" : ONE_CHAR });
        push({ type: "paren", extglob: true, value: advance(), output });
        extglobs.push(token);
      };
      const extglobClose = (token) => {
        const literal = input.slice(token.startIndex, state.index + 1);
        const body = input.slice(token.startIndex + 2, state.index);
        const analysis = analyzeRepeatedExtglob(body, opts);
        if ((token.type === "plus" || token.type === "star") && analysis.risky) {
          const safeOutput = analysis.safeOutput ? (token.output ? "" : ONE_CHAR) + (opts.capture ? `(${analysis.safeOutput})` : analysis.safeOutput) : void 0;
          const open = tokens[token.tokensIndex];
          open.type = "text";
          open.value = literal;
          open.output = safeOutput || utils.escapeRegex(literal);
          for (let i = token.tokensIndex + 1; i < tokens.length; i++) {
            tokens[i].value = "";
            tokens[i].output = "";
            delete tokens[i].suffix;
          }
          state.output = token.output + open.output;
          state.backtrack = true;
          push({ type: "paren", extglob: true, value, output: "" });
          decrement("parens");
          return;
        }
        let output = token.close + (opts.capture ? ")" : "");
        let rest;
        if (token.type === "negate") {
          let extglobStar = star;
          if (token.inner && token.inner.length > 1 && token.inner.includes("/")) {
            extglobStar = globstar(opts);
          }
          if (extglobStar !== star || eos() || /^\)+$/.test(remaining())) {
            output = token.close = `)$))${extglobStar}`;
          }
          if (token.inner.includes("*") && (rest = remaining()) && /^\.[^\\/.]+$/.test(rest)) {
            const expression = parse(rest, { ...options, fastpaths: false }).output;
            output = token.close = `)${expression})${extglobStar})`;
          }
          if (token.prev.type === "bos") {
            state.negatedExtglob = true;
          }
        }
        push({ type: "paren", extglob: true, value, output });
        decrement("parens");
      };
      if (opts.fastpaths !== false && !/(^[*!]|[/()[\]{}"])/.test(input)) {
        let backslashes = false;
        let output = input.replace(REGEX_SPECIAL_CHARS_BACKREF, (m, esc, chars, first, rest, index) => {
          if (first === "\\") {
            backslashes = true;
            return m;
          }
          if (first === "?") {
            if (esc) {
              return esc + first + (rest ? QMARK.repeat(rest.length) : "");
            }
            if (index === 0) {
              return qmarkNoDot + (rest ? QMARK.repeat(rest.length) : "");
            }
            return QMARK.repeat(chars.length);
          }
          if (first === ".") {
            return DOT_LITERAL.repeat(chars.length);
          }
          if (first === "*") {
            if (esc) {
              return esc + first + (rest ? star : "");
            }
            return star;
          }
          return esc ? m : `\\${m}`;
        });
        if (backslashes === true) {
          if (opts.unescape === true) {
            output = output.replace(/\\/g, "");
          } else {
            output = output.replace(/\\+/g, (m) => {
              return m.length % 2 === 0 ? "\\\\" : m ? "\\" : "";
            });
          }
        }
        if (output === input && opts.contains === true) {
          state.output = input;
          return state;
        }
        state.output = utils.wrapOutput(output, state, options);
        return state;
      }
      while (!eos()) {
        value = advance();
        if (value === "\0") {
          continue;
        }
        if (value === "\\") {
          const next = peek();
          if (next === "/" && opts.bash !== true) {
            continue;
          }
          if (next === "." || next === ";") {
            continue;
          }
          if (!next) {
            value += "\\";
            push({ type: "text", value });
            continue;
          }
          const match = /^\\+/.exec(remaining());
          let slashes = 0;
          if (match && match[0].length > 2) {
            slashes = match[0].length;
            state.index += slashes;
            if (slashes % 2 !== 0) {
              value += "\\";
            }
          }
          if (opts.unescape === true) {
            value = advance();
          } else {
            value += advance();
          }
          if (state.brackets === 0) {
            push({ type: "text", value });
            continue;
          }
        }
        if (state.brackets > 0 && (value !== "]" || prev.value === "[" || prev.value === "[^")) {
          if (opts.posix !== false && value === ":") {
            const inner = prev.value.slice(1);
            if (inner.includes("[")) {
              prev.posix = true;
              if (inner.includes(":")) {
                const idx = prev.value.lastIndexOf("[");
                const pre = prev.value.slice(0, idx);
                const rest2 = prev.value.slice(idx + 2);
                const posix2 = POSIX_REGEX_SOURCE[rest2];
                if (posix2) {
                  prev.value = pre + posix2;
                  state.backtrack = true;
                  advance();
                  if (!bos.output && tokens.indexOf(prev) === 1) {
                    bos.output = ONE_CHAR;
                  }
                  continue;
                }
              }
            }
          }
          if (value === "[" && peek() !== ":" || value === "-" && peek() === "]") {
            value = `\\${value}`;
          }
          if (value === "]" && (prev.value === "[" || prev.value === "[^")) {
            value = `\\${value}`;
          }
          if (opts.posix === true && value === "!" && prev.value === "[") {
            value = "^";
          }
          prev.value += value;
          append({ value });
          continue;
        }
        if (state.quotes === 1 && value !== '"') {
          value = utils.escapeRegex(value);
          prev.value += value;
          append({ value });
          continue;
        }
        if (value === '"') {
          state.quotes = state.quotes === 1 ? 0 : 1;
          if (opts.keepQuotes === true) {
            push({ type: "text", value });
          }
          continue;
        }
        if (value === "(") {
          increment("parens");
          push({ type: "paren", value });
          continue;
        }
        if (value === ")") {
          if (state.parens === 0 && opts.strictBrackets === true) {
            throw new SyntaxError(syntaxError("opening", "("));
          }
          const extglob = extglobs[extglobs.length - 1];
          if (extglob && state.parens === extglob.parens + 1) {
            extglobClose(extglobs.pop());
            continue;
          }
          push({ type: "paren", value, output: state.parens ? ")" : "\\)" });
          decrement("parens");
          continue;
        }
        if (value === "[") {
          if (opts.nobracket === true || !remaining().includes("]")) {
            if (opts.nobracket !== true && opts.strictBrackets === true) {
              throw new SyntaxError(syntaxError("closing", "]"));
            }
            value = `\\${value}`;
          } else {
            increment("brackets");
          }
          push({ type: "bracket", value });
          continue;
        }
        if (value === "]") {
          if (opts.nobracket === true || prev && prev.type === "bracket" && prev.value.length === 1) {
            push({ type: "text", value, output: `\\${value}` });
            continue;
          }
          if (state.brackets === 0) {
            if (opts.strictBrackets === true) {
              throw new SyntaxError(syntaxError("opening", "["));
            }
            push({ type: "text", value, output: `\\${value}` });
            continue;
          }
          decrement("brackets");
          const prevValue = prev.value.slice(1);
          if (prev.posix !== true && prevValue[0] === "^" && !prevValue.includes("/")) {
            value = `/${value}`;
          }
          prev.value += value;
          append({ value });
          if (opts.literalBrackets === false || utils.hasRegexChars(prevValue)) {
            continue;
          }
          const escaped = utils.escapeRegex(prev.value);
          state.output = state.output.slice(0, -prev.value.length);
          if (opts.literalBrackets === true) {
            state.output += escaped;
            prev.value = escaped;
            continue;
          }
          prev.value = `(${capture}${escaped}|${prev.value})`;
          state.output += prev.value;
          continue;
        }
        if (value === "{" && opts.nobrace !== true) {
          increment("braces");
          const open = {
            type: "brace",
            value,
            output: "(",
            outputIndex: state.output.length,
            tokensIndex: state.tokens.length
          };
          braces.push(open);
          push(open);
          continue;
        }
        if (value === "}") {
          const brace = braces[braces.length - 1];
          if (opts.nobrace === true || !brace) {
            push({ type: "text", value, output: value });
            continue;
          }
          let output = ")";
          if (brace.dots === true) {
            const arr = tokens.slice();
            const range = [];
            for (let i = arr.length - 1; i >= 0; i--) {
              tokens.pop();
              if (arr[i].type === "brace") {
                break;
              }
              if (arr[i].type !== "dots") {
                range.unshift(arr[i].value);
              }
            }
            output = expandRange(range, opts);
            state.backtrack = true;
          }
          if (brace.comma !== true && brace.dots !== true) {
            const out2 = state.output.slice(0, brace.outputIndex);
            const toks = state.tokens.slice(brace.tokensIndex);
            brace.value = brace.output = "\\{";
            value = output = "\\}";
            state.output = out2;
            for (const t of toks) {
              state.output += t.output || t.value;
            }
          }
          push({ type: "brace", value, output });
          decrement("braces");
          braces.pop();
          continue;
        }
        if (value === "|") {
          if (extglobs.length > 0) {
            extglobs[extglobs.length - 1].conditions++;
          }
          push({ type: "text", value });
          continue;
        }
        if (value === ",") {
          let output = value;
          const brace = braces[braces.length - 1];
          if (brace && stack[stack.length - 1] === "braces") {
            brace.comma = true;
            output = "|";
          }
          push({ type: "comma", value, output });
          continue;
        }
        if (value === "/") {
          if (prev.type === "dot" && state.index === state.start + 1) {
            state.start = state.index + 1;
            state.consumed = "";
            state.output = "";
            tokens.pop();
            prev = bos;
            continue;
          }
          push({ type: "slash", value, output: SLASH_LITERAL });
          continue;
        }
        if (value === ".") {
          if (state.braces > 0 && prev.type === "dot") {
            if (prev.value === ".") prev.output = DOT_LITERAL;
            const brace = braces[braces.length - 1];
            prev.type = "dots";
            prev.output += value;
            prev.value += value;
            brace.dots = true;
            continue;
          }
          if (state.braces + state.parens === 0 && prev.type !== "bos" && prev.type !== "slash") {
            push({ type: "text", value, output: DOT_LITERAL });
            continue;
          }
          push({ type: "dot", value, output: DOT_LITERAL });
          continue;
        }
        if (value === "?") {
          const isGroup = prev && prev.value === "(";
          if (!isGroup && opts.noextglob !== true && peek() === "(" && peek(2) !== "?") {
            extglobOpen("qmark", value);
            continue;
          }
          if (prev && prev.type === "paren") {
            const next = peek();
            let output = value;
            if (prev.value === "(" && !/[!=<:]/.test(next) || next === "<" && !/<([!=]|\w+>)/.test(remaining())) {
              output = `\\${value}`;
            }
            push({ type: "text", value, output });
            continue;
          }
          if (opts.dot !== true && (prev.type === "slash" || prev.type === "bos")) {
            push({ type: "qmark", value, output: QMARK_NO_DOT });
            continue;
          }
          push({ type: "qmark", value, output: QMARK });
          continue;
        }
        if (value === "!") {
          if (opts.noextglob !== true && peek() === "(") {
            if (peek(2) !== "?" || !/[!=<:]/.test(peek(3))) {
              extglobOpen("negate", value);
              continue;
            }
          }
          if (opts.nonegate !== true && state.index === 0) {
            negate();
            continue;
          }
        }
        if (value === "+") {
          if (opts.noextglob !== true && peek() === "(" && peek(2) !== "?") {
            extglobOpen("plus", value);
            continue;
          }
          if (prev && prev.value === "(" || opts.regex === false) {
            push({ type: "plus", value, output: PLUS_LITERAL });
            continue;
          }
          if (prev && (prev.type === "bracket" || prev.type === "paren" || prev.type === "brace") || state.parens > 0) {
            push({ type: "plus", value });
            continue;
          }
          push({ type: "plus", value: PLUS_LITERAL });
          continue;
        }
        if (value === "@") {
          if (opts.noextglob !== true && peek() === "(" && peek(2) !== "?") {
            push({ type: "at", extglob: true, value, output: "" });
            continue;
          }
          push({ type: "text", value });
          continue;
        }
        if (value !== "*") {
          if (value === "$" || value === "^") {
            value = `\\${value}`;
          }
          const match = REGEX_NON_SPECIAL_CHARS.exec(remaining());
          if (match) {
            value += match[0];
            state.index += match[0].length;
          }
          push({ type: "text", value });
          continue;
        }
        if (prev && (prev.type === "globstar" || prev.star === true)) {
          prev.type = "star";
          prev.star = true;
          prev.value += value;
          prev.output = star;
          state.backtrack = true;
          state.globstar = true;
          consume(value);
          continue;
        }
        let rest = remaining();
        if (opts.noextglob !== true && /^\([^?]/.test(rest)) {
          extglobOpen("star", value);
          continue;
        }
        if (prev.type === "star") {
          if (opts.noglobstar === true) {
            consume(value);
            continue;
          }
          const prior = prev.prev;
          const before = prior.prev;
          const isStart = prior.type === "slash" || prior.type === "bos";
          const afterStar = before && (before.type === "star" || before.type === "globstar");
          if (opts.bash === true && (!isStart || rest[0] && rest[0] !== "/")) {
            push({ type: "star", value, output: "" });
            continue;
          }
          const isBrace = state.braces > 0 && (prior.type === "comma" || prior.type === "brace");
          const isExtglob = extglobs.length && (prior.type === "pipe" || prior.type === "paren");
          if (!isStart && prior.type !== "paren" && !isBrace && !isExtglob) {
            push({ type: "star", value, output: "" });
            continue;
          }
          while (rest.slice(0, 3) === "/**") {
            const after = input[state.index + 4];
            if (after && after !== "/") {
              break;
            }
            rest = rest.slice(3);
            consume("/**", 3);
          }
          const isEnd = eos() || state.parens > 0 && rest === ")".repeat(state.parens) && !extglobs.some((extglob) => extglob.type === "negate");
          if (prior.type === "bos" && eos()) {
            prev.type = "globstar";
            prev.value += value;
            prev.output = globstar(opts);
            state.output = prev.output;
            state.globstar = true;
            consume(value);
            continue;
          }
          if (prior.type === "slash" && prior.prev.type !== "bos" && !afterStar && isEnd) {
            state.output = state.output.slice(0, -(prior.output + prev.output).length);
            prior.output = `(?:${prior.output}`;
            prev.type = "globstar";
            prev.output = globstar(opts) + (opts.strictSlashes ? ")" : "|$)");
            prev.value += value;
            state.globstar = true;
            state.output += prior.output + prev.output;
            consume(value);
            continue;
          }
          if (prior.type === "slash" && prior.prev.type !== "bos" && rest[0] === "/") {
            const end = rest[1] !== void 0 ? "|$" : "";
            state.output = state.output.slice(0, -(prior.output + prev.output).length);
            prior.output = `(?:${prior.output}`;
            prev.type = "globstar";
            prev.output = `${globstar(opts)}${SLASH_LITERAL}|${SLASH_LITERAL}${end})`;
            prev.value += value;
            state.output += prior.output + prev.output;
            state.globstar = true;
            consume(value + advance());
            push({ type: "slash", value: "/", output: "" });
            continue;
          }
          if (prior.type === "bos" && rest[0] === "/") {
            prev.type = "globstar";
            prev.value += value;
            prev.output = `(?:^|${SLASH_LITERAL}|${globstar(opts)}${SLASH_LITERAL})`;
            state.output = prev.output;
            state.globstar = true;
            consume(value + advance());
            push({ type: "slash", value: "/", output: "" });
            continue;
          }
          state.output = state.output.slice(0, -prev.output.length);
          prev.type = "globstar";
          prev.output = globstar(opts);
          prev.value += value;
          state.output += prev.output;
          state.globstar = true;
          consume(value);
          continue;
        }
        const token = { type: "star", value, output: star };
        if (opts.bash === true) {
          token.output = ".*?";
          if (prev.type === "bos" || prev.type === "slash") {
            token.output = nodot + token.output;
          }
          push(token);
          continue;
        }
        if (prev && (prev.type === "bracket" || prev.type === "paren") && opts.regex === true) {
          token.output = value;
          push(token);
          continue;
        }
        if (state.index === state.start || prev.type === "slash" || prev.type === "dot") {
          if (prev.type === "dot") {
            state.output += NO_DOT_SLASH;
            prev.output += NO_DOT_SLASH;
          } else if (opts.dot === true) {
            state.output += NO_DOTS_SLASH;
            prev.output += NO_DOTS_SLASH;
          } else {
            state.output += nodot;
            prev.output += nodot;
          }
          if (peek() !== "*") {
            state.output += ONE_CHAR;
            prev.output += ONE_CHAR;
          }
        }
        push(token);
      }
      while (state.brackets > 0) {
        if (opts.strictBrackets === true) throw new SyntaxError(syntaxError("closing", "]"));
        state.output = utils.escapeLast(state.output, "[");
        decrement("brackets");
      }
      while (state.parens > 0) {
        if (opts.strictBrackets === true) throw new SyntaxError(syntaxError("closing", ")"));
        state.output = utils.escapeLast(state.output, "(");
        decrement("parens");
      }
      while (state.braces > 0) {
        if (opts.strictBrackets === true) throw new SyntaxError(syntaxError("closing", "}"));
        state.output = utils.escapeLast(state.output, "{");
        decrement("braces");
      }
      if (opts.strictSlashes !== true && (prev.type === "star" || prev.type === "bracket")) {
        push({ type: "maybe_slash", value: "", output: `${SLASH_LITERAL}?` });
      }
      if (state.backtrack === true) {
        state.output = "";
        for (const token of state.tokens) {
          state.output += token.output != null ? token.output : token.value;
          if (token.suffix) {
            state.output += token.suffix;
          }
        }
      }
      return state;
    };
    parse.fastpaths = (input, options) => {
      const opts = { ...options };
      const max = typeof opts.maxLength === "number" ? Math.min(MAX_LENGTH, opts.maxLength) : MAX_LENGTH;
      const len = input.length;
      if (len > max) {
        throw new SyntaxError(`Input length: ${len}, exceeds maximum allowed length: ${max}`);
      }
      input = REPLACEMENTS[input] || input;
      const {
        DOT_LITERAL,
        SLASH_LITERAL,
        ONE_CHAR,
        DOTS_SLASH,
        NO_DOT,
        NO_DOTS,
        NO_DOTS_SLASH,
        STAR,
        START_ANCHOR
      } = constants.globChars(opts.windows);
      const nodot = opts.dot ? NO_DOTS : NO_DOT;
      const slashDot = opts.dot ? NO_DOTS_SLASH : NO_DOT;
      const capture = opts.capture ? "" : "?:";
      const state = { negated: false, prefix: "" };
      let star = opts.bash === true ? ".*?" : STAR;
      if (opts.capture) {
        star = `(${star})`;
      }
      const globstar = (opts2) => {
        if (opts2.noglobstar === true) return star;
        return `(${capture}(?:(?!${START_ANCHOR}${opts2.dot ? DOTS_SLASH : DOT_LITERAL}).)*?)`;
      };
      const create = (str) => {
        switch (str) {
          case "*":
            return `${nodot}${ONE_CHAR}${star}`;
          case ".*":
            return `${DOT_LITERAL}${ONE_CHAR}${star}`;
          case "*.*":
            return `${nodot}${star}${DOT_LITERAL}${ONE_CHAR}${star}`;
          case "*/*":
            return `${nodot}${star}${SLASH_LITERAL}${ONE_CHAR}${slashDot}${star}`;
          case "**":
            return nodot + globstar(opts);
          case "**/*":
            return `(?:${nodot}${globstar(opts)}${SLASH_LITERAL})?${slashDot}${ONE_CHAR}${star}`;
          case "**/*.*":
            return `(?:${nodot}${globstar(opts)}${SLASH_LITERAL})?${slashDot}${star}${DOT_LITERAL}${ONE_CHAR}${star}`;
          case "**/.*":
            return `(?:${nodot}${globstar(opts)}${SLASH_LITERAL})?${DOT_LITERAL}${ONE_CHAR}${star}`;
          default: {
            const match = /^(.*?)\.(\w+)$/.exec(str);
            if (!match) return;
            const source2 = create(match[1]);
            if (!source2) return;
            return source2 + DOT_LITERAL + match[2];
          }
        }
      };
      const output = utils.removePrefix(input, state);
      let source = create(output);
      if (source && opts.strictSlashes !== true) {
        source += `${SLASH_LITERAL}?`;
      }
      return source;
    };
    module.exports = parse;
  }
});

// ../../node_modules/.pnpm/picomatch@4.0.7/node_modules/picomatch/lib/picomatch.js
var require_picomatch = __commonJS({
  "../../node_modules/.pnpm/picomatch@4.0.7/node_modules/picomatch/lib/picomatch.js"(exports, module) {
    "use strict";
    var scan2 = require_scan();
    var parse = require_parse();
    var utils = require_utils();
    var constants = require_constants();
    var isObject = (val) => val && typeof val === "object" && !Array.isArray(val);
    var picomatch4 = (glob, options, returnState = false) => {
      if (Array.isArray(glob)) {
        const fns = glob.map((input) => picomatch4(input, options, returnState));
        const arrayMatcher = (str) => {
          for (const isMatch of fns) {
            const state2 = isMatch(str);
            if (state2) return state2;
          }
          return false;
        };
        return arrayMatcher;
      }
      const isState = isObject(glob) && glob.tokens && glob.input;
      if (glob === "" || typeof glob !== "string" && !isState) {
        throw new TypeError("Expected pattern to be a non-empty string");
      }
      const opts = options || {};
      const posix2 = opts.windows;
      const regex = isState ? picomatch4.compileRe(glob, options) : picomatch4.makeRe(glob, options, false, true);
      const state = regex.state;
      delete regex.state;
      let isIgnored = () => false;
      if (opts.ignore) {
        const ignoreOpts = { ...options, ignore: null, onMatch: null, onResult: null };
        isIgnored = picomatch4(opts.ignore, ignoreOpts, returnState);
      }
      const matcher = (input, returnObject = false) => {
        const { isMatch, match, output } = picomatch4.test(input, regex, options, { glob, posix: posix2 });
        const result = { glob, state, regex, posix: posix2, input, output, match, isMatch };
        if (typeof opts.onResult === "function") {
          opts.onResult(result);
        }
        if (isMatch === false) {
          result.isMatch = false;
          return returnObject ? result : false;
        }
        if (isIgnored(input)) {
          if (typeof opts.onIgnore === "function") {
            opts.onIgnore(result);
          }
          result.isMatch = false;
          return returnObject ? result : false;
        }
        if (typeof opts.onMatch === "function") {
          opts.onMatch(result);
        }
        return returnObject ? result : true;
      };
      if (returnState) {
        matcher.state = state;
      }
      return matcher;
    };
    picomatch4.test = (input, regex, options, { glob, posix: posix2 } = {}) => {
      if (typeof input !== "string") {
        throw new TypeError("Expected input to be a string");
      }
      if (input === "") {
        return { isMatch: false, output: "" };
      }
      const opts = options || {};
      const format = opts.format || (posix2 ? utils.toPosixSlashes : null);
      let match = input === glob;
      let output = match && format ? format(input) : input;
      if (match === false) {
        output = format ? format(input) : input;
        match = output === glob;
      }
      if (match === false || opts.capture === true) {
        if (opts.matchBase === true || opts.basename === true) {
          match = picomatch4.matchBase(input, regex, options, posix2);
        } else {
          match = regex.exec(output);
        }
      }
      return { isMatch: Boolean(match), match, output };
    };
    picomatch4.matchBase = (input, glob, options, posix2 = options && options.windows) => {
      const regex = glob instanceof RegExp ? glob : picomatch4.makeRe(glob, options);
      return regex.test(utils.basename(input, { windows: posix2 }));
    };
    picomatch4.isMatch = (str, patterns, options) => picomatch4(patterns, options)(str);
    picomatch4.parse = (pattern, options) => {
      if (Array.isArray(pattern)) return pattern.map((p) => picomatch4.parse(p, options));
      return parse(pattern, { ...options, fastpaths: false });
    };
    picomatch4.scan = (input, options) => scan2(input, options);
    picomatch4.compileRe = (state, options, returnOutput = false, returnState = false) => {
      if (returnOutput === true) {
        return state.output;
      }
      const opts = options || {};
      const prepend = opts.contains ? "" : "^";
      const append = opts.contains ? "" : "$";
      let source = `${prepend}(?:${state.output})${append}`;
      if (state && state.negated === true) {
        source = `^(?!${source}).*$`;
      }
      const regex = picomatch4.toRegex(source, options);
      if (returnState === true) {
        regex.state = state;
      }
      return regex;
    };
    picomatch4.makeRe = (input, options = {}, returnOutput = false, returnState = false) => {
      if (!input || typeof input !== "string") {
        throw new TypeError("Expected a non-empty string");
      }
      let parsed2 = { negated: false, fastpaths: true };
      if (options.fastpaths !== false && (input[0] === "." || input[0] === "*")) {
        parsed2.output = parse.fastpaths(input, options);
      }
      if (!parsed2.output) {
        parsed2 = parse(input, options);
      }
      return picomatch4.compileRe(parsed2, options, returnOutput, returnState);
    };
    picomatch4.toRegex = (source, options) => {
      try {
        const opts = options || {};
        return new RegExp(source, opts.flags || (opts.nocase ? "i" : ""));
      } catch (err) {
        if (options && options.debug === true) throw err;
        return /$^/;
      }
    };
    picomatch4.constants = constants;
    module.exports = picomatch4;
  }
});

// ../../node_modules/.pnpm/picomatch@4.0.7/node_modules/picomatch/index.js
var require_picomatch2 = __commonJS({
  "../../node_modules/.pnpm/picomatch@4.0.7/node_modules/picomatch/index.js"(exports, module) {
    "use strict";
    var pico = require_picomatch();
    var utils = require_utils();
    function picomatch4(glob, options, returnState = false) {
      if (options && (options.windows === null || options.windows === void 0)) {
        options = { ...options, windows: utils.isWindows() };
      }
      return pico(glob, options, returnState);
    }
    Object.assign(picomatch4, pico);
    module.exports = picomatch4;
  }
});

// ../../node_modules/.pnpm/commander@15.1.0/node_modules/commander/lib/error.js
var CommanderError = class extends Error {
  /**
   * Constructs the CommanderError class
   * @param {number} exitCode suggested exit code which could be used with process.exit
   * @param {string} code an id string representing the error
   * @param {string} message human-readable description of the error
   */
  constructor(exitCode, code, message) {
    super(message);
    Error.captureStackTrace(this, this.constructor);
    this.name = this.constructor.name;
    this.code = code;
    this.exitCode = exitCode;
    this.nestedError = void 0;
  }
};
var InvalidArgumentError = class extends CommanderError {
  /**
   * Constructs the InvalidArgumentError class
   * @param {string} [message] explanation of why argument is invalid
   */
  constructor(message) {
    super(1, "commander.invalidArgument", message);
    Error.captureStackTrace(this, this.constructor);
    this.name = this.constructor.name;
  }
};

// ../../node_modules/.pnpm/commander@15.1.0/node_modules/commander/lib/argument.js
var Argument = class {
  /**
   * Initialize a new command argument with the given name and description.
   * The default is that the argument is required, and you can explicitly
   * indicate this with <> around the name. Put [] around the name for an optional argument.
   *
   * @param {string} name
   * @param {string} [description]
   */
  constructor(name, description) {
    this.description = description || "";
    this.variadic = false;
    this.parseArg = void 0;
    this.defaultValue = void 0;
    this.defaultValueDescription = void 0;
    this.argChoices = void 0;
    switch (name[0]) {
      case "<":
        this.required = true;
        this._name = name.slice(1, -1);
        break;
      case "[":
        this.required = false;
        this._name = name.slice(1, -1);
        break;
      default:
        this.required = true;
        this._name = name;
        break;
    }
    if (this._name.endsWith("...")) {
      this.variadic = true;
      this._name = this._name.slice(0, -3);
    }
  }
  /**
   * Return argument name.
   *
   * @return {string}
   */
  name() {
    return this._name;
  }
  /**
   * @package
   */
  _collectValue(value, previous) {
    if (previous === this.defaultValue || !Array.isArray(previous)) {
      return [value];
    }
    previous.push(value);
    return previous;
  }
  /**
   * Set the default value, and optionally supply the description to be displayed in the help.
   *
   * @param {*} value
   * @param {string} [description]
   * @return {Argument}
   */
  default(value, description) {
    this.defaultValue = value;
    this.defaultValueDescription = description;
    return this;
  }
  /**
   * Set the custom handler for processing CLI command arguments into argument values.
   *
   * @param {Function} [fn]
   * @return {Argument}
   */
  argParser(fn) {
    this.parseArg = fn;
    return this;
  }
  /**
   * Only allow argument value to be one of choices.
   *
   * @param {string[]} values
   * @return {Argument}
   */
  choices(values) {
    this.argChoices = values.slice();
    this.parseArg = (arg, previous) => {
      if (!this.argChoices.includes(arg)) {
        throw new InvalidArgumentError(
          `Allowed choices are ${this.argChoices.join(", ")}.`
        );
      }
      if (this.variadic) {
        return this._collectValue(arg, previous);
      }
      return arg;
    };
    return this;
  }
  /**
   * Make argument required.
   *
   * @returns {Argument}
   */
  argRequired() {
    this.required = true;
    return this;
  }
  /**
   * Make argument optional.
   *
   * @returns {Argument}
   */
  argOptional() {
    this.required = false;
    return this;
  }
};
function humanReadableArgName(arg) {
  const nameOutput = arg.name() + (arg.variadic === true ? "..." : "");
  return arg.required ? "<" + nameOutput + ">" : "[" + nameOutput + "]";
}

// ../../node_modules/.pnpm/commander@15.1.0/node_modules/commander/lib/command.js
import { EventEmitter } from "node:events";
import childProcess from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import process2 from "node:process";
import { stripVTControlCharacters as stripVTControlCharacters2 } from "node:util";

// ../../node_modules/.pnpm/commander@15.1.0/node_modules/commander/lib/help.js
import { stripVTControlCharacters } from "node:util";
var Help = class {
  constructor() {
    this.helpWidth = void 0;
    this.minWidthToWrap = 40;
    this.sortSubcommands = false;
    this.sortOptions = false;
    this.showGlobalOptions = false;
  }
  /**
   * prepareContext is called by Commander after applying overrides from `Command.configureHelp()`
   * and just before calling `formatHelp()`.
   *
   * Commander just uses the helpWidth and the rest is provided for optional use by more complex subclasses.
   *
   * @param {{ error?: boolean, helpWidth?: number, outputHasColors?: boolean }} contextOptions
   */
  prepareContext(contextOptions) {
    this.helpWidth = this.helpWidth ?? contextOptions.helpWidth ?? 80;
  }
  /**
   * Get an array of the visible subcommands. Includes a placeholder for the implicit help command, if there is one.
   *
   * @param {Command} cmd
   * @returns {Command[]}
   */
  visibleCommands(cmd) {
    const visibleCommands = cmd.commands.filter((cmd2) => !cmd2._hidden);
    const helpCommand = cmd._getHelpCommand();
    if (helpCommand && !helpCommand._hidden) {
      visibleCommands.push(helpCommand);
    }
    if (this.sortSubcommands) {
      visibleCommands.sort((a, b) => {
        return a.name().localeCompare(b.name());
      });
    }
    return visibleCommands;
  }
  /**
   * Compare options for sort.
   *
   * @param {Option} a
   * @param {Option} b
   * @returns {number}
   */
  compareOptions(a, b) {
    const getSortKey = (option) => {
      return option.short ? option.short.replace(/^-/, "") : option.long.replace(/^--/, "");
    };
    return getSortKey(a).localeCompare(getSortKey(b));
  }
  /**
   * Get an array of the visible options. Includes a placeholder for the implicit help option, if there is one.
   *
   * @param {Command} cmd
   * @returns {Option[]}
   */
  visibleOptions(cmd) {
    const visibleOptions = cmd.options.filter((option) => !option.hidden);
    const helpOption = cmd._getHelpOption();
    if (helpOption && !helpOption.hidden) {
      const removeShort = helpOption.short && cmd._findOption(helpOption.short);
      const removeLong = helpOption.long && cmd._findOption(helpOption.long);
      if (!removeShort && !removeLong) {
        visibleOptions.push(helpOption);
      } else if (helpOption.long && !removeLong) {
        visibleOptions.push(
          cmd.createOption(helpOption.long, helpOption.description).helpGroup(helpOption.helpGroupHeading)
        );
      } else if (helpOption.short && !removeShort) {
        visibleOptions.push(
          cmd.createOption(helpOption.short, helpOption.description).helpGroup(helpOption.helpGroupHeading)
        );
      }
    }
    if (this.sortOptions) {
      visibleOptions.sort(this.compareOptions);
    }
    return visibleOptions;
  }
  /**
   * Get an array of the visible global options. (Not including help.)
   *
   * @param {Command} cmd
   * @returns {Option[]}
   */
  visibleGlobalOptions(cmd) {
    if (!this.showGlobalOptions) return [];
    const globalOptions = [];
    for (let ancestorCmd = cmd.parent; ancestorCmd; ancestorCmd = ancestorCmd.parent) {
      const visibleOptions = ancestorCmd.options.filter(
        (option) => !option.hidden
      );
      globalOptions.push(...visibleOptions);
    }
    if (this.sortOptions) {
      globalOptions.sort(this.compareOptions);
    }
    return globalOptions;
  }
  /**
   * Get an array of the arguments if any have a description.
   *
   * @param {Command} cmd
   * @returns {Argument[]}
   */
  visibleArguments(cmd) {
    if (cmd._argsDescription) {
      cmd.registeredArguments.forEach((argument) => {
        argument.description = argument.description || cmd._argsDescription[argument.name()] || "";
      });
    }
    if (cmd.registeredArguments.find((argument) => argument.description)) {
      return cmd.registeredArguments;
    }
    return [];
  }
  /**
   * Get the command term to show in the list of subcommands.
   *
   * @param {Command} cmd
   * @returns {string}
   */
  subcommandTerm(cmd) {
    const args = cmd.registeredArguments.map((arg) => humanReadableArgName(arg)).join(" ");
    return cmd._name + (cmd._aliases[0] ? "|" + cmd._aliases[0] : "") + (cmd.options.length ? " [options]" : "") + // simplistic check for non-help option
    (args ? " " + args : "");
  }
  /**
   * Get the option term to show in the list of options.
   *
   * @param {Option} option
   * @returns {string}
   */
  optionTerm(option) {
    return option.flags;
  }
  /**
   * Get the argument term to show in the list of arguments.
   *
   * @param {Argument} argument
   * @returns {string}
   */
  argumentTerm(argument) {
    return argument.name();
  }
  /**
   * Get the longest command term length.
   *
   * @param {Command} cmd
   * @param {Help} helper
   * @returns {number}
   */
  longestSubcommandTermLength(cmd, helper) {
    return helper.visibleCommands(cmd).reduce((max, command) => {
      return Math.max(
        max,
        this.displayWidth(
          helper.styleSubcommandTerm(helper.subcommandTerm(command))
        )
      );
    }, 0);
  }
  /**
   * Get the longest option term length.
   *
   * @param {Command} cmd
   * @param {Help} helper
   * @returns {number}
   */
  longestOptionTermLength(cmd, helper) {
    return helper.visibleOptions(cmd).reduce((max, option) => {
      return Math.max(
        max,
        this.displayWidth(helper.styleOptionTerm(helper.optionTerm(option)))
      );
    }, 0);
  }
  /**
   * Get the longest global option term length.
   *
   * @param {Command} cmd
   * @param {Help} helper
   * @returns {number}
   */
  longestGlobalOptionTermLength(cmd, helper) {
    return helper.visibleGlobalOptions(cmd).reduce((max, option) => {
      return Math.max(
        max,
        this.displayWidth(helper.styleOptionTerm(helper.optionTerm(option)))
      );
    }, 0);
  }
  /**
   * Get the longest argument term length.
   *
   * @param {Command} cmd
   * @param {Help} helper
   * @returns {number}
   */
  longestArgumentTermLength(cmd, helper) {
    return helper.visibleArguments(cmd).reduce((max, argument) => {
      return Math.max(
        max,
        this.displayWidth(
          helper.styleArgumentTerm(helper.argumentTerm(argument))
        )
      );
    }, 0);
  }
  /**
   * Get the command usage to be displayed at the top of the built-in help.
   *
   * @param {Command} cmd
   * @returns {string}
   */
  commandUsage(cmd) {
    let cmdName = cmd._name;
    if (cmd._aliases[0]) {
      cmdName = cmdName + "|" + cmd._aliases[0];
    }
    let ancestorCmdNames = "";
    for (let ancestorCmd = cmd.parent; ancestorCmd; ancestorCmd = ancestorCmd.parent) {
      ancestorCmdNames = ancestorCmd.name() + " " + ancestorCmdNames;
    }
    return ancestorCmdNames + cmdName + " " + cmd.usage();
  }
  /**
   * Get the description for the command.
   *
   * @param {Command} cmd
   * @returns {string}
   */
  commandDescription(cmd) {
    return cmd.description();
  }
  /**
   * Get the subcommand summary to show in the list of subcommands.
   * (Fallback to description for backwards compatibility.)
   *
   * @param {Command} cmd
   * @returns {string}
   */
  subcommandDescription(cmd) {
    return cmd.summary() || cmd.description();
  }
  /**
   * Get the option description to show in the list of options.
   *
   * @param {Option} option
   * @return {string}
   */
  optionDescription(option) {
    const extraInfo = [];
    if (option.argChoices) {
      extraInfo.push(
        // use stringify to match the display of the default value
        `choices: ${option.argChoices.map((choice) => JSON.stringify(choice)).join(", ")}`
      );
    }
    if (option.defaultValue !== void 0) {
      const showDefault = option.required || option.optional || option.isBoolean() && typeof option.defaultValue === "boolean";
      if (showDefault) {
        extraInfo.push(
          `default: ${option.defaultValueDescription || JSON.stringify(option.defaultValue)}`
        );
      }
    }
    if (option.presetArg !== void 0 && option.optional) {
      extraInfo.push(`preset: ${JSON.stringify(option.presetArg)}`);
    }
    if (option.envVar !== void 0) {
      extraInfo.push(`env: ${option.envVar}`);
    }
    if (extraInfo.length > 0) {
      const extraDescription = `(${extraInfo.join(", ")})`;
      if (option.description) {
        return `${option.description} ${extraDescription}`;
      }
      return extraDescription;
    }
    return option.description;
  }
  /**
   * Get the argument description to show in the list of arguments.
   *
   * @param {Argument} argument
   * @return {string}
   */
  argumentDescription(argument) {
    const extraInfo = [];
    if (argument.argChoices) {
      extraInfo.push(
        // use stringify to match the display of the default value
        `choices: ${argument.argChoices.map((choice) => JSON.stringify(choice)).join(", ")}`
      );
    }
    if (argument.defaultValue !== void 0) {
      extraInfo.push(
        `default: ${argument.defaultValueDescription || JSON.stringify(argument.defaultValue)}`
      );
    }
    if (extraInfo.length > 0) {
      const extraDescription = `(${extraInfo.join(", ")})`;
      if (argument.description) {
        return `${argument.description} ${extraDescription}`;
      }
      return extraDescription;
    }
    return argument.description;
  }
  /**
   * Format a list of items, given a heading and an array of formatted items.
   *
   * @param {string} heading
   * @param {string[]} items
   * @param {Help} helper
   * @returns string[]
   */
  formatItemList(heading, items, helper) {
    if (items.length === 0) return [];
    return [helper.styleTitle(heading), ...items, ""];
  }
  /**
   * Group items by their help group heading.
   *
   * @param {Command[] | Option[]} unsortedItems
   * @param {Command[] | Option[]} visibleItems
   * @param {Function} getGroup
   * @returns {Map<string, Command[] | Option[]>}
   */
  groupItems(unsortedItems, visibleItems, getGroup) {
    const result = /* @__PURE__ */ new Map();
    unsortedItems.forEach((item) => {
      const group = getGroup(item);
      if (!result.has(group)) result.set(group, []);
    });
    visibleItems.forEach((item) => {
      const group = getGroup(item);
      if (!result.has(group)) {
        result.set(group, []);
      }
      result.get(group).push(item);
    });
    return result;
  }
  /**
   * Generate the built-in help text.
   *
   * @param {Command} cmd
   * @param {Help} helper
   * @returns {string}
   */
  formatHelp(cmd, helper) {
    const termWidth = helper.padWidth(cmd, helper);
    const helpWidth = helper.helpWidth ?? 80;
    function callFormatItem(term, description) {
      return helper.formatItem(term, termWidth, description, helper);
    }
    let output = [
      `${helper.styleTitle("Usage:")} ${helper.styleUsage(helper.commandUsage(cmd))}`,
      ""
    ];
    const commandDescription = helper.commandDescription(cmd);
    if (commandDescription.length > 0) {
      output = output.concat([
        helper.boxWrap(
          helper.styleCommandDescription(commandDescription),
          helpWidth
        ),
        ""
      ]);
    }
    const argumentList = helper.visibleArguments(cmd).map((argument) => {
      return callFormatItem(
        helper.styleArgumentTerm(helper.argumentTerm(argument)),
        helper.styleArgumentDescription(helper.argumentDescription(argument))
      );
    });
    output = output.concat(
      this.formatItemList("Arguments:", argumentList, helper)
    );
    const optionGroups = this.groupItems(
      cmd.options,
      helper.visibleOptions(cmd),
      (option) => option.helpGroupHeading ?? "Options:"
    );
    optionGroups.forEach((options, group) => {
      const optionList = options.map((option) => {
        return callFormatItem(
          helper.styleOptionTerm(helper.optionTerm(option)),
          helper.styleOptionDescription(helper.optionDescription(option))
        );
      });
      output = output.concat(this.formatItemList(group, optionList, helper));
    });
    if (helper.showGlobalOptions) {
      const globalOptionList = helper.visibleGlobalOptions(cmd).map((option) => {
        return callFormatItem(
          helper.styleOptionTerm(helper.optionTerm(option)),
          helper.styleOptionDescription(helper.optionDescription(option))
        );
      });
      output = output.concat(
        this.formatItemList("Global Options:", globalOptionList, helper)
      );
    }
    const commandGroups = this.groupItems(
      cmd.commands,
      helper.visibleCommands(cmd),
      (sub) => sub.helpGroup() || "Commands:"
    );
    commandGroups.forEach((commands, group) => {
      const commandList = commands.map((sub) => {
        return callFormatItem(
          helper.styleSubcommandTerm(helper.subcommandTerm(sub)),
          helper.styleSubcommandDescription(helper.subcommandDescription(sub))
        );
      });
      output = output.concat(this.formatItemList(group, commandList, helper));
    });
    return output.join("\n");
  }
  /**
   * Return display width of string, ignoring ANSI escape sequences. Used in padding and wrapping calculations.
   *
   * @param {string} str
   * @returns {number}
   */
  displayWidth(str) {
    return stripVTControlCharacters(str).length;
  }
  /**
   * Style the title for displaying in the help. Called with 'Usage:', 'Options:', etc.
   *
   * @param {string} str
   * @returns {string}
   */
  styleTitle(str) {
    return str;
  }
  styleUsage(str) {
    return str.split(" ").map((word) => {
      if (word === "[options]") return this.styleOptionText(word);
      if (word === "[command]") return this.styleSubcommandText(word);
      if (word[0] === "[" || word[0] === "<")
        return this.styleArgumentText(word);
      return this.styleCommandText(word);
    }).join(" ");
  }
  styleCommandDescription(str) {
    return this.styleDescriptionText(str);
  }
  styleOptionDescription(str) {
    return this.styleDescriptionText(str);
  }
  styleSubcommandDescription(str) {
    return this.styleDescriptionText(str);
  }
  styleArgumentDescription(str) {
    return this.styleDescriptionText(str);
  }
  styleDescriptionText(str) {
    return str;
  }
  styleOptionTerm(str) {
    return this.styleOptionText(str);
  }
  styleSubcommandTerm(str) {
    return str.split(" ").map((word) => {
      if (word === "[options]") return this.styleOptionText(word);
      if (word[0] === "[" || word[0] === "<")
        return this.styleArgumentText(word);
      return this.styleSubcommandText(word);
    }).join(" ");
  }
  styleArgumentTerm(str) {
    return this.styleArgumentText(str);
  }
  styleOptionText(str) {
    return str;
  }
  styleArgumentText(str) {
    return str;
  }
  styleSubcommandText(str) {
    return str;
  }
  styleCommandText(str) {
    return str;
  }
  /**
   * Calculate the pad width from the maximum term length.
   *
   * @param {Command} cmd
   * @param {Help} helper
   * @returns {number}
   */
  padWidth(cmd, helper) {
    return Math.max(
      helper.longestOptionTermLength(cmd, helper),
      helper.longestGlobalOptionTermLength(cmd, helper),
      helper.longestSubcommandTermLength(cmd, helper),
      helper.longestArgumentTermLength(cmd, helper)
    );
  }
  /**
   * Detect manually wrapped and indented strings by checking for line break followed by whitespace.
   *
   * @param {string} str
   * @returns {boolean}
   */
  preformatted(str) {
    return /\n[^\S\r\n]/.test(str);
  }
  /**
   * Format the "item", which consists of a term and description. Pad the term and wrap the description, indenting the following lines.
   *
   * So "TTT", 5, "DDD DDDD DD DDD" might be formatted for this.helpWidth=17 like so:
   *   TTT  DDD DDDD
   *        DD DDD
   *
   * @param {string} term
   * @param {number} termWidth
   * @param {string} description
   * @param {Help} helper
   * @returns {string}
   */
  formatItem(term, termWidth, description, helper) {
    const itemIndent = 2;
    const itemIndentStr = " ".repeat(itemIndent);
    if (!description) return itemIndentStr + term;
    const paddedTerm = term.padEnd(
      termWidth + term.length - helper.displayWidth(term)
    );
    const spacerWidth = 2;
    const helpWidth = this.helpWidth ?? 80;
    const remainingWidth = helpWidth - termWidth - spacerWidth - itemIndent;
    let formattedDescription;
    if (remainingWidth < this.minWidthToWrap || helper.preformatted(description)) {
      formattedDescription = description;
    } else {
      const wrappedDescription = helper.boxWrap(description, remainingWidth);
      formattedDescription = wrappedDescription.replace(
        /\n/g,
        "\n" + " ".repeat(termWidth + spacerWidth)
      );
    }
    return itemIndentStr + paddedTerm + " ".repeat(spacerWidth) + formattedDescription.replace(/\n/g, `
${itemIndentStr}`);
  }
  /**
   * Wrap a string at whitespace, preserving existing line breaks.
   * Wrapping is skipped if the width is less than `minWidthToWrap`.
   *
   * @param {string} str
   * @param {number} width
   * @returns {string}
   */
  boxWrap(str, width) {
    if (width < this.minWidthToWrap) return str;
    const rawLines = str.split(/\r\n|\n/);
    const chunkPattern = /[\s]*[^\s]+/g;
    const wrappedLines = [];
    rawLines.forEach((line) => {
      const chunks = line.match(chunkPattern);
      if (chunks === null) {
        wrappedLines.push("");
        return;
      }
      let sumChunks = [chunks.shift()];
      let sumWidth = this.displayWidth(sumChunks[0]);
      chunks.forEach((chunk) => {
        const visibleWidth = this.displayWidth(chunk);
        if (sumWidth + visibleWidth <= width) {
          sumChunks.push(chunk);
          sumWidth += visibleWidth;
          return;
        }
        wrappedLines.push(sumChunks.join(""));
        const nextChunk = chunk.trimStart();
        sumChunks = [nextChunk];
        sumWidth = this.displayWidth(nextChunk);
      });
      wrappedLines.push(sumChunks.join(""));
    });
    return wrappedLines.join("\n");
  }
};

// ../../node_modules/.pnpm/commander@15.1.0/node_modules/commander/lib/option.js
var Option = class {
  /**
   * Initialize a new `Option` with the given `flags` and `description`.
   *
   * @param {string} flags
   * @param {string} [description]
   */
  constructor(flags, description) {
    this.flags = flags;
    this.description = description || "";
    this.required = flags.includes("<");
    this.optional = flags.includes("[");
    this.variadic = new RegExp("\\p{ID_Continue}\\.\\.\\.[>\\]]$", "u").test(flags);
    this.mandatory = false;
    const optionFlags = splitOptionFlags(flags);
    this.short = optionFlags.shortFlag;
    this.long = optionFlags.longFlag;
    this.negate = false;
    if (this.long) {
      this.negate = this.long.startsWith("--no-");
    }
    this.defaultValue = void 0;
    this.defaultValueDescription = void 0;
    this.presetArg = void 0;
    this.envVar = void 0;
    this.parseArg = void 0;
    this.hidden = false;
    this.argChoices = void 0;
    this.conflictsWith = [];
    this.implied = void 0;
    this.helpGroupHeading = void 0;
  }
  /**
   * Set the default value, and optionally supply the description to be displayed in the help.
   *
   * @param {*} value
   * @param {string} [description]
   * @return {Option}
   */
  default(value, description) {
    this.defaultValue = value;
    this.defaultValueDescription = description;
    return this;
  }
  /**
   * Preset to use when option used without option-argument, especially optional but also boolean and negated.
   * The custom processing (parseArg) is called.
   *
   * @example
   * new Option('--color').default('GREYSCALE').preset('RGB');
   * new Option('--donate [amount]').preset('20').argParser(parseFloat);
   *
   * @param {*} arg
   * @return {Option}
   */
  preset(arg) {
    this.presetArg = arg;
    return this;
  }
  /**
   * Add option name(s) that conflict with this option.
   * An error will be displayed if conflicting options are found during parsing.
   *
   * @example
   * new Option('--rgb').conflicts('cmyk');
   * new Option('--js').conflicts(['ts', 'jsx']);
   *
   * @param {(string | string[])} names
   * @return {Option}
   */
  conflicts(names) {
    this.conflictsWith = this.conflictsWith.concat(names);
    return this;
  }
  /**
   * Specify implied option values for when this option is set and the implied options are not.
   *
   * The custom processing (parseArg) is not called on the implied values.
   *
   * @example
   * program
   *   .addOption(new Option('--log', 'write logging information to file'))
   *   .addOption(new Option('--trace', 'log extra details').implies({ log: 'trace.txt' }));
   *
   * @param {object} impliedOptionValues
   * @return {Option}
   */
  implies(impliedOptionValues) {
    let newImplied = impliedOptionValues;
    if (typeof impliedOptionValues === "string") {
      newImplied = { [impliedOptionValues]: true };
    }
    this.implied = Object.assign(this.implied || {}, newImplied);
    return this;
  }
  /**
   * Set environment variable to check for option value.
   *
   * An environment variable is only used if when processed the current option value is
   * undefined, or the source of the current value is 'default' or 'config' or 'env'.
   *
   * @param {string} name
   * @return {Option}
   */
  env(name) {
    this.envVar = name;
    return this;
  }
  /**
   * Set the custom handler for processing CLI option arguments into option values.
   *
   * @param {Function} [fn]
   * @return {Option}
   */
  argParser(fn) {
    this.parseArg = fn;
    return this;
  }
  /**
   * Whether the option is mandatory and must have a value after parsing.
   *
   * @param {boolean} [mandatory=true]
   * @return {Option}
   */
  makeOptionMandatory(mandatory = true) {
    this.mandatory = !!mandatory;
    return this;
  }
  /**
   * Hide option in help.
   *
   * @param {boolean} [hide=true]
   * @return {Option}
   */
  hideHelp(hide = true) {
    this.hidden = !!hide;
    return this;
  }
  /**
   * @package
   */
  _collectValue(value, previous) {
    if (previous === this.defaultValue || !Array.isArray(previous)) {
      return [value];
    }
    previous.push(value);
    return previous;
  }
  /**
   * Only allow option value to be one of choices.
   *
   * @param {string[]} values
   * @return {Option}
   */
  choices(values) {
    this.argChoices = values.slice();
    this.parseArg = (arg, previous) => {
      if (!this.argChoices.includes(arg)) {
        throw new InvalidArgumentError(
          `Allowed choices are ${this.argChoices.join(", ")}.`
        );
      }
      if (this.variadic) {
        return this._collectValue(arg, previous);
      }
      return arg;
    };
    return this;
  }
  /**
   * Return option name.
   *
   * @return {string}
   */
  name() {
    if (this.long) {
      return this.long.replace(/^--/, "");
    }
    return this.short.replace(/^-/, "");
  }
  /**
   * Return option name, in a camelcase format that can be used
   * as an object attribute key.
   *
   * @return {string}
   */
  attributeName() {
    if (this.negate) {
      return camelcase(this.name().replace(/^no-/, ""));
    }
    return camelcase(this.name());
  }
  /**
   * Set the help group heading.
   *
   * @param {string} heading
   * @return {Option}
   */
  helpGroup(heading) {
    this.helpGroupHeading = heading;
    return this;
  }
  /**
   * Check if `arg` matches the short or long flag.
   *
   * @param {string} arg
   * @return {boolean}
   * @package
   */
  is(arg) {
    return this.short === arg || this.long === arg;
  }
  /**
   * Return whether a boolean option.
   *
   * Options are one of boolean, negated, required argument, or optional argument.
   *
   * @return {boolean}
   * @package
   */
  isBoolean() {
    return !this.required && !this.optional && !this.negate;
  }
};
var DualOptions = class {
  /**
   * @param {Option[]} options
   */
  constructor(options) {
    this.positiveOptions = /* @__PURE__ */ new Map();
    this.negativeOptions = /* @__PURE__ */ new Map();
    this.dualOptions = /* @__PURE__ */ new Set();
    options.forEach((option) => {
      if (option.negate) {
        this.negativeOptions.set(option.attributeName(), option);
      } else {
        this.positiveOptions.set(option.attributeName(), option);
      }
    });
    this.negativeOptions.forEach((value, key) => {
      if (this.positiveOptions.has(key)) {
        this.dualOptions.add(key);
      }
    });
  }
  /**
   * Did the value come from the option, and not from possible matching dual option?
   *
   * @param {*} value
   * @param {Option} option
   * @returns {boolean}
   */
  valueFromOption(value, option) {
    const optionKey = option.attributeName();
    if (!this.dualOptions.has(optionKey)) return true;
    const preset = this.negativeOptions.get(optionKey).presetArg;
    const negativeValue = preset !== void 0 ? preset : false;
    return option.negate === (negativeValue === value);
  }
};
function camelcase(str) {
  return str.split("-").reduce((str2, word) => {
    return str2 + word[0].toUpperCase() + word.slice(1);
  });
}
function splitOptionFlags(flags) {
  let shortFlag;
  let longFlag;
  const shortFlagExp = /^-[^-]$/;
  const longFlagExp = /^--[^-]/;
  const flagParts = flags.split(/[ |,]+/).concat("guard");
  if (shortFlagExp.test(flagParts[0])) shortFlag = flagParts.shift();
  if (longFlagExp.test(flagParts[0])) longFlag = flagParts.shift();
  if (!shortFlag && shortFlagExp.test(flagParts[0]))
    shortFlag = flagParts.shift();
  if (!shortFlag && longFlagExp.test(flagParts[0])) {
    shortFlag = longFlag;
    longFlag = flagParts.shift();
  }
  if (flagParts[0].startsWith("-")) {
    const unsupportedFlag = flagParts[0];
    const baseError = `option creation failed due to '${unsupportedFlag}' in option flags '${flags}'`;
    if (/^-[^-][^-]/.test(unsupportedFlag))
      throw new Error(
        `${baseError}
- a short flag is a single dash and a single character
  - either use a single dash and a single character (for a short flag)
  - or use a double dash for a long option (and can have two, like '--ws, --workspace')`
      );
    if (shortFlagExp.test(unsupportedFlag))
      throw new Error(`${baseError}
- too many short flags`);
    if (longFlagExp.test(unsupportedFlag))
      throw new Error(`${baseError}
- too many long flags`);
    throw new Error(`${baseError}
- unrecognised flag format`);
  }
  if (shortFlag === void 0 && longFlag === void 0)
    throw new Error(
      `option creation failed due to no flags found in '${flags}'.`
    );
  return { shortFlag, longFlag };
}

// ../../node_modules/.pnpm/commander@15.1.0/node_modules/commander/lib/suggestSimilar.js
var maxDistance = 3;
function editDistance(a, b) {
  if (Math.abs(a.length - b.length) > maxDistance)
    return Math.max(a.length, b.length);
  const d = [];
  for (let i = 0; i <= a.length; i++) {
    d[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    d[0][j] = j;
  }
  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      let cost;
      if (a[i - 1] === b[j - 1]) {
        cost = 0;
      } else {
        cost = 1;
      }
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        // deletion
        d[i][j - 1] + 1,
        // insertion
        d[i - 1][j - 1] + cost
        // substitution
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}
function suggestSimilar(word, candidates) {
  if (!candidates || candidates.length === 0) return "";
  candidates = Array.from(new Set(candidates));
  const searchingOptions = word.startsWith("--");
  if (searchingOptions) {
    word = word.slice(2);
    candidates = candidates.map((candidate) => candidate.slice(2));
  }
  let similar = [];
  let bestDistance = maxDistance;
  const minSimilarity = 0.4;
  candidates.forEach((candidate) => {
    if (candidate.length <= 1) return;
    const distance = editDistance(word, candidate);
    const length = Math.max(word.length, candidate.length);
    const similarity = (length - distance) / length;
    if (similarity > minSimilarity) {
      if (distance < bestDistance) {
        bestDistance = distance;
        similar = [candidate];
      } else if (distance === bestDistance) {
        similar.push(candidate);
      }
    }
  });
  similar.sort((a, b) => a.localeCompare(b));
  if (searchingOptions) {
    similar = similar.map((candidate) => `--${candidate}`);
  }
  if (similar.length > 1) {
    return `
(Did you mean one of ${similar.join(", ")}?)`;
  }
  if (similar.length === 1) {
    return `
(Did you mean ${similar[0]}?)`;
  }
  return "";
}

// ../../node_modules/.pnpm/commander@15.1.0/node_modules/commander/lib/command.js
var Command = class _Command extends EventEmitter {
  /**
   * Initialize a new `Command`.
   *
   * @param {string} [name]
   */
  constructor(name) {
    super();
    this.commands = [];
    this.options = [];
    this.parent = null;
    this._allowUnknownOption = false;
    this._allowExcessArguments = false;
    this.registeredArguments = [];
    this._args = this.registeredArguments;
    this.args = [];
    this.rawArgs = [];
    this.processedArgs = [];
    this._scriptPath = null;
    this._name = name || "";
    this._optionValues = {};
    this._optionValueSources = {};
    this._storeOptionsAsProperties = false;
    this._actionHandler = null;
    this._executableHandler = false;
    this._executableFile = null;
    this._executableDir = null;
    this._defaultCommandName = null;
    this._exitCallback = null;
    this._aliases = [];
    this._combineFlagAndOptionalValue = true;
    this._description = "";
    this._summary = "";
    this._argsDescription = void 0;
    this._enablePositionalOptions = false;
    this._passThroughOptions = false;
    this._lifeCycleHooks = {};
    this._showHelpAfterError = false;
    this._showSuggestionAfterError = true;
    this._savedState = null;
    this._outputConfiguration = {
      writeOut: (str) => process2.stdout.write(str),
      writeErr: (str) => process2.stderr.write(str),
      outputError: (str, write) => write(str),
      getOutHelpWidth: () => process2.stdout.isTTY ? process2.stdout.columns : void 0,
      getErrHelpWidth: () => process2.stderr.isTTY ? process2.stderr.columns : void 0,
      getOutHasColors: () => useColor() ?? (process2.stdout.isTTY && process2.stdout.hasColors?.()),
      getErrHasColors: () => useColor() ?? (process2.stderr.isTTY && process2.stderr.hasColors?.()),
      stripColor: (str) => stripVTControlCharacters2(str)
    };
    this._hidden = false;
    this._helpOption = void 0;
    this._addImplicitHelpCommand = void 0;
    this._helpCommand = void 0;
    this._helpConfiguration = {};
    this._helpGroupHeading = void 0;
    this._defaultCommandGroup = void 0;
    this._defaultOptionGroup = void 0;
  }
  /**
   * Copy settings that are useful to have in common across root command and subcommands.
   *
   * (Used internally when adding a command using `.command()` so subcommands inherit parent settings.)
   *
   * @param {Command} sourceCommand
   * @return {Command} `this` command for chaining
   */
  copyInheritedSettings(sourceCommand) {
    this._outputConfiguration = sourceCommand._outputConfiguration;
    this._helpOption = sourceCommand._helpOption;
    this._helpCommand = sourceCommand._helpCommand;
    this._helpConfiguration = sourceCommand._helpConfiguration;
    this._exitCallback = sourceCommand._exitCallback;
    this._storeOptionsAsProperties = sourceCommand._storeOptionsAsProperties;
    this._combineFlagAndOptionalValue = sourceCommand._combineFlagAndOptionalValue;
    this._allowExcessArguments = sourceCommand._allowExcessArguments;
    this._enablePositionalOptions = sourceCommand._enablePositionalOptions;
    this._showHelpAfterError = sourceCommand._showHelpAfterError;
    this._showSuggestionAfterError = sourceCommand._showSuggestionAfterError;
    return this;
  }
  /**
   * @returns {Command[]}
   * @private
   */
  _getCommandAndAncestors() {
    const result = [];
    for (let command = this; command; command = command.parent) {
      result.push(command);
    }
    return result;
  }
  /**
   * Define a command.
   *
   * There are two styles of command: pay attention to where to put the description.
   *
   * @example
   * // Command implemented using action handler (description is supplied separately to `.command`)
   * program
   *   .command('clone <source> [destination]')
   *   .description('clone a repository into a newly created directory')
   *   .action((source, destination) => {
   *     console.log('clone command called');
   *   });
   *
   * // Command implemented using separate executable file (description is second parameter to `.command`)
   * program
   *   .command('start <service>', 'start named service')
   *   .command('stop [service]', 'stop named service, or all if no name supplied');
   *
   * @param {string} nameAndArgs - command name and arguments, args are `<required>` or `[optional]` and last may also be `variadic...`
   * @param {(object | string)} [actionOptsOrExecDesc] - configuration options (for action), or description (for executable)
   * @param {object} [execOpts] - configuration options (for executable)
   * @return {Command} returns new command for action handler, or `this` for executable command
   */
  command(nameAndArgs, actionOptsOrExecDesc, execOpts) {
    let desc = actionOptsOrExecDesc;
    let opts = execOpts;
    if (typeof desc === "object" && desc !== null) {
      opts = desc;
      desc = null;
    }
    opts = opts || {};
    const [, name, args] = nameAndArgs.match(/([^ ]+) *(.*)/);
    const cmd = this.createCommand(name);
    if (desc) {
      cmd.description(desc);
      cmd._executableHandler = true;
    }
    if (opts.isDefault) this._defaultCommandName = cmd._name;
    cmd._hidden = !!(opts.noHelp || opts.hidden);
    cmd._executableFile = opts.executableFile || null;
    if (args) cmd.arguments(args);
    this._registerCommand(cmd);
    cmd.parent = this;
    cmd.copyInheritedSettings(this);
    if (desc) return this;
    return cmd;
  }
  /**
   * Factory routine to create a new unattached command.
   *
   * See .command() for creating an attached subcommand, which uses this routine to
   * create the command. You can override createCommand to customise subcommands.
   *
   * @param {string} [name]
   * @return {Command} new command
   */
  createCommand(name) {
    return new _Command(name);
  }
  /**
   * You can customise the help with a subclass of Help by overriding createHelp,
   * or by overriding Help properties using configureHelp().
   *
   * @return {Help}
   */
  createHelp() {
    return Object.assign(new Help(), this.configureHelp());
  }
  /**
   * You can customise the help by overriding Help properties using configureHelp(),
   * or with a subclass of Help by overriding createHelp().
   *
   * @param {object} [configuration] - configuration options
   * @return {(Command | object)} `this` command for chaining, or stored configuration
   */
  configureHelp(configuration) {
    if (configuration === void 0) return this._helpConfiguration;
    this._helpConfiguration = configuration;
    return this;
  }
  /**
   * The default output goes to stdout and stderr. You can customise this for special
   * applications. You can also customise the display of errors by overriding outputError.
   *
   * The configuration properties are all functions:
   *
   *     // change how output being written, defaults to stdout and stderr
   *     writeOut(str)
   *     writeErr(str)
   *     // change how output being written for errors, defaults to writeErr
   *     outputError(str, write) // used for displaying errors and not used for displaying help
   *     // specify width for wrapping help
   *     getOutHelpWidth()
   *     getErrHelpWidth()
   *     // color support, currently only used with Help
   *     getOutHasColors()
   *     getErrHasColors()
   *     stripColor() // used to remove ANSI escape codes if output does not have colors
   *
   * @param {object} [configuration] - configuration options
   * @return {(Command | object)} `this` command for chaining, or stored configuration
   */
  configureOutput(configuration) {
    if (configuration === void 0) return this._outputConfiguration;
    this._outputConfiguration = {
      ...this._outputConfiguration,
      ...configuration
    };
    return this;
  }
  /**
   * Display the help or a custom message after an error occurs.
   *
   * @param {(boolean|string)} [displayHelp]
   * @return {Command} `this` command for chaining
   */
  showHelpAfterError(displayHelp = true) {
    if (typeof displayHelp !== "string") displayHelp = !!displayHelp;
    this._showHelpAfterError = displayHelp;
    return this;
  }
  /**
   * Display suggestion of similar commands for unknown commands, or options for unknown options.
   *
   * @param {boolean} [displaySuggestion]
   * @return {Command} `this` command for chaining
   */
  showSuggestionAfterError(displaySuggestion = true) {
    this._showSuggestionAfterError = !!displaySuggestion;
    return this;
  }
  /**
   * Add a prepared subcommand.
   *
   * See .command() for creating an attached subcommand which inherits settings from its parent.
   *
   * @param {Command} cmd - new subcommand
   * @param {object} [opts] - configuration options
   * @return {Command} `this` command for chaining
   */
  addCommand(cmd, opts) {
    if (!cmd._name) {
      throw new Error(`Command passed to .addCommand() must have a name
- specify the name in Command constructor or using .name()`);
    }
    opts = opts || {};
    if (opts.isDefault) this._defaultCommandName = cmd._name;
    if (opts.noHelp || opts.hidden) cmd._hidden = true;
    this._registerCommand(cmd);
    cmd.parent = this;
    cmd._checkForBrokenPassThrough();
    return this;
  }
  /**
   * Factory routine to create a new unattached argument.
   *
   * See .argument() for creating an attached argument, which uses this routine to
   * create the argument. You can override createArgument to return a custom argument.
   *
   * @param {string} name
   * @param {string} [description]
   * @return {Argument} new argument
   */
  createArgument(name, description) {
    return new Argument(name, description);
  }
  /**
   * Define argument syntax for command.
   *
   * The default is that the argument is required, and you can explicitly
   * indicate this with <> around the name. Put [] around the name for an optional argument.
   *
   * @example
   * program.argument('<input-file>');
   * program.argument('[output-file]');
   *
   * @param {string} name
   * @param {string} [description]
   * @param {(Function|*)} [parseArg] - custom argument processing function or default value
   * @param {*} [defaultValue]
   * @return {Command} `this` command for chaining
   */
  argument(name, description, parseArg, defaultValue) {
    const argument = this.createArgument(name, description);
    if (typeof parseArg === "function") {
      argument.default(defaultValue).argParser(parseArg);
    } else {
      argument.default(parseArg);
    }
    this.addArgument(argument);
    return this;
  }
  /**
   * Define argument syntax for command, adding multiple at once (without descriptions).
   *
   * See also .argument().
   *
   * @example
   * program.arguments('<cmd> [env]');
   *
   * @param {string} names
   * @return {Command} `this` command for chaining
   */
  arguments(names) {
    names.trim().split(/ +/).forEach((detail) => {
      this.argument(detail);
    });
    return this;
  }
  /**
   * Define argument syntax for command, adding a prepared argument.
   *
   * @param {Argument} argument
   * @return {Command} `this` command for chaining
   */
  addArgument(argument) {
    const previousArgument = this.registeredArguments.slice(-1)[0];
    if (previousArgument?.variadic) {
      throw new Error(
        `only the last argument can be variadic '${previousArgument.name()}'`
      );
    }
    if (argument.required && argument.defaultValue !== void 0 && argument.parseArg === void 0) {
      throw new Error(
        `a default value for a required argument is never used: '${argument.name()}'`
      );
    }
    this.registeredArguments.push(argument);
    return this;
  }
  /**
   * Customise or override default help command. By default a help command is automatically added if your command has subcommands.
   *
   * @example
   *    program.helpCommand('help [cmd]');
   *    program.helpCommand('help [cmd]', 'show help');
   *    program.helpCommand(false); // suppress default help command
   *    program.helpCommand(true); // add help command even if no subcommands
   *
   * @param {string|boolean} enableOrNameAndArgs - enable with custom name and/or arguments, or boolean to override whether added
   * @param {string} [description] - custom description
   * @return {Command} `this` command for chaining
   */
  helpCommand(enableOrNameAndArgs, description) {
    if (typeof enableOrNameAndArgs === "boolean") {
      this._addImplicitHelpCommand = enableOrNameAndArgs;
      if (enableOrNameAndArgs && this._defaultCommandGroup) {
        this._initCommandGroup(this._getHelpCommand());
      }
      return this;
    }
    const nameAndArgs = enableOrNameAndArgs ?? "help [command]";
    const [, helpName, helpArgs] = nameAndArgs.match(/([^ ]+) *(.*)/);
    const helpDescription = description ?? "display help for command";
    const helpCommand = this.createCommand(helpName);
    helpCommand.helpOption(false);
    if (helpArgs) helpCommand.arguments(helpArgs);
    if (helpDescription) helpCommand.description(helpDescription);
    this._addImplicitHelpCommand = true;
    this._helpCommand = helpCommand;
    if (enableOrNameAndArgs || description) this._initCommandGroup(helpCommand);
    return this;
  }
  /**
   * Add prepared custom help command.
   *
   * @param {(Command|string|boolean)} helpCommand - custom help command, or deprecated enableOrNameAndArgs as for `.helpCommand()`
   * @param {string} [deprecatedDescription] - deprecated custom description used with custom name only
   * @return {Command} `this` command for chaining
   */
  addHelpCommand(helpCommand, deprecatedDescription) {
    if (typeof helpCommand !== "object") {
      this.helpCommand(helpCommand, deprecatedDescription);
      return this;
    }
    this._addImplicitHelpCommand = true;
    this._helpCommand = helpCommand;
    this._initCommandGroup(helpCommand);
    return this;
  }
  /**
   * Lazy create help command.
   *
   * @return {(Command|null)}
   * @package
   */
  _getHelpCommand() {
    const hasImplicitHelpCommand = this._addImplicitHelpCommand ?? (this.commands.length && !this._actionHandler && !this._findCommand("help"));
    if (hasImplicitHelpCommand) {
      if (this._helpCommand === void 0) {
        this.helpCommand(void 0, void 0);
      }
      return this._helpCommand;
    }
    return null;
  }
  /**
   * Add hook for life cycle event.
   *
   * @param {string} event
   * @param {Function} listener
   * @return {Command} `this` command for chaining
   */
  hook(event, listener) {
    const allowedValues = ["preSubcommand", "preAction", "postAction"];
    if (!allowedValues.includes(event)) {
      throw new Error(`Unexpected value for event passed to hook : '${event}'.
Expecting one of '${allowedValues.join("', '")}'`);
    }
    if (this._lifeCycleHooks[event]) {
      this._lifeCycleHooks[event].push(listener);
    } else {
      this._lifeCycleHooks[event] = [listener];
    }
    return this;
  }
  /**
   * Register callback to use as replacement for calling process.exit.
   *
   * @param {Function} [fn] optional callback which will be passed a CommanderError, defaults to throwing
   * @return {Command} `this` command for chaining
   */
  exitOverride(fn) {
    if (fn) {
      this._exitCallback = fn;
    } else {
      this._exitCallback = (err) => {
        if (err.code !== "commander.executeSubCommandAsync") {
          throw err;
        } else {
        }
      };
    }
    return this;
  }
  /**
   * Call process.exit, and _exitCallback if defined.
   *
   * @param {number} exitCode exit code for using with process.exit
   * @param {string} code an id string representing the error
   * @param {string} message human-readable description of the error
   * @return never
   * @private
   */
  _exit(exitCode, code, message) {
    if (this._exitCallback) {
      this._exitCallback(new CommanderError(exitCode, code, message));
    }
    process2.exit(exitCode);
  }
  /**
   * Register callback `fn` for the command.
   *
   * @example
   * program
   *   .command('serve')
   *   .description('start service')
   *   .action(function() {
   *      // do work here
   *   });
   *
   * @param {Function} fn
   * @return {Command} `this` command for chaining
   */
  action(fn) {
    const listener = (args) => {
      const expectedArgsCount = this.registeredArguments.length;
      const actionArgs = args.slice(0, expectedArgsCount);
      if (this._storeOptionsAsProperties) {
        actionArgs[expectedArgsCount] = this;
      } else {
        actionArgs[expectedArgsCount] = this.opts();
      }
      actionArgs.push(this);
      return fn.apply(this, actionArgs);
    };
    this._actionHandler = listener;
    return this;
  }
  /**
   * Factory routine to create a new unattached option.
   *
   * See .option() for creating an attached option, which uses this routine to
   * create the option. You can override createOption to return a custom option.
   *
   * @param {string} flags
   * @param {string} [description]
   * @return {Option} new option
   */
  createOption(flags, description) {
    return new Option(flags, description);
  }
  /**
   * Wrap parseArgs to catch 'commander.invalidArgument'.
   *
   * @param {(Option | Argument)} target
   * @param {string} value
   * @param {*} previous
   * @param {string} invalidArgumentMessage
   * @private
   */
  _callParseArg(target, value, previous, invalidArgumentMessage) {
    try {
      return target.parseArg(value, previous);
    } catch (err) {
      if (err.code === "commander.invalidArgument") {
        const message = `${invalidArgumentMessage} ${err.message}`;
        this.error(message, { exitCode: err.exitCode, code: err.code });
      }
      throw err;
    }
  }
  /**
   * Check for option flag conflicts.
   * Register option if no conflicts found, or throw on conflict.
   *
   * @param {Option} option
   * @private
   */
  _registerOption(option) {
    const matchingOption = option.short && this._findOption(option.short) || option.long && this._findOption(option.long);
    if (matchingOption) {
      const matchingFlag = option.long && this._findOption(option.long) ? option.long : option.short;
      throw new Error(`Cannot add option '${option.flags}'${this._name && ` to command '${this._name}'`} due to conflicting flag '${matchingFlag}'
-  already used by option '${matchingOption.flags}'`);
    }
    this._initOptionGroup(option);
    this.options.push(option);
  }
  /**
   * Check for command name and alias conflicts with existing commands.
   * Register command if no conflicts found, or throw on conflict.
   *
   * @param {Command} command
   * @private
   */
  _registerCommand(command) {
    const knownBy = (cmd) => {
      return [cmd.name()].concat(cmd.aliases());
    };
    const alreadyUsed = knownBy(command).find(
      (name) => this._findCommand(name)
    );
    if (alreadyUsed) {
      const existingCmd = knownBy(this._findCommand(alreadyUsed)).join("|");
      const newCmd = knownBy(command).join("|");
      throw new Error(
        `cannot add command '${newCmd}' as already have command '${existingCmd}'`
      );
    }
    this._initCommandGroup(command);
    this.commands.push(command);
  }
  /**
   * Add an option.
   *
   * @param {Option} option
   * @return {Command} `this` command for chaining
   */
  addOption(option) {
    this._registerOption(option);
    const oname = option.name();
    const name = option.attributeName();
    if (option.defaultValue !== void 0) {
      this.setOptionValueWithSource(name, option.defaultValue, "default");
    }
    const handleOptionValue = (val, invalidValueMessage, valueSource) => {
      if (val == null && option.presetArg !== void 0) {
        val = option.presetArg;
      }
      const oldValue = this.getOptionValue(name);
      if (val !== null && option.parseArg) {
        val = this._callParseArg(option, val, oldValue, invalidValueMessage);
      } else if (val !== null && option.variadic) {
        val = option._collectValue(val, oldValue);
      }
      if (val == null) {
        if (option.negate) {
          val = false;
        } else if (option.isBoolean() || option.optional) {
          val = true;
        } else {
          val = "";
        }
      }
      this.setOptionValueWithSource(name, val, valueSource);
    };
    this.on("option:" + oname, (val) => {
      const invalidValueMessage = `error: option '${option.flags}' argument '${val}' is invalid.`;
      handleOptionValue(val, invalidValueMessage, "cli");
    });
    if (option.envVar) {
      this.on("optionEnv:" + oname, (val) => {
        const invalidValueMessage = `error: option '${option.flags}' value '${val}' from env '${option.envVar}' is invalid.`;
        handleOptionValue(val, invalidValueMessage, "env");
      });
    }
    return this;
  }
  /**
   * Internal implementation shared by .option() and .requiredOption()
   *
   * @return {Command} `this` command for chaining
   * @private
   */
  _optionEx(config, flags, description, fn, defaultValue) {
    if (typeof flags === "object" && flags instanceof Option) {
      throw new Error(
        "To add an Option object use addOption() instead of option() or requiredOption()"
      );
    }
    const option = this.createOption(flags, description);
    option.makeOptionMandatory(!!config.mandatory);
    if (typeof fn === "function") {
      option.default(defaultValue).argParser(fn);
    } else if (fn instanceof RegExp) {
      const regex = fn;
      fn = (val, def) => {
        const m = regex.exec(val);
        return m ? m[0] : def;
      };
      option.default(defaultValue).argParser(fn);
    } else {
      option.default(fn);
    }
    return this.addOption(option);
  }
  /**
   * Define option with `flags`, `description`, and optional argument parsing function or `defaultValue` or both.
   *
   * The `flags` string contains the short and/or long flags, separated by comma, a pipe or space. A required
   * option-argument is indicated by `<>` and an optional option-argument by `[]`.
   *
   * See the README for more details, and see also addOption() and requiredOption().
   *
   * @example
   * program
   *     .option('-p, --pepper', 'add pepper')
   *     .option('--pt, --pizza-type <TYPE>', 'type of pizza') // required option-argument
   *     .option('-c, --cheese [CHEESE]', 'add extra cheese', 'mozzarella') // optional option-argument with default
   *     .option('-t, --tip <VALUE>', 'add tip to purchase cost', parseFloat) // custom parse function
   *
   * @param {string} flags
   * @param {string} [description]
   * @param {(Function|*)} [parseArg] - custom option processing function or default value
   * @param {*} [defaultValue]
   * @return {Command} `this` command for chaining
   */
  option(flags, description, parseArg, defaultValue) {
    return this._optionEx({}, flags, description, parseArg, defaultValue);
  }
  /**
   * Add a required option which must have a value after parsing. This usually means
   * the option must be specified on the command line. (Otherwise the same as .option().)
   *
   * The `flags` string contains the short and/or long flags, separated by comma, a pipe or space.
   *
   * @param {string} flags
   * @param {string} [description]
   * @param {(Function|*)} [parseArg] - custom option processing function or default value
   * @param {*} [defaultValue]
   * @return {Command} `this` command for chaining
   */
  requiredOption(flags, description, parseArg, defaultValue) {
    return this._optionEx(
      { mandatory: true },
      flags,
      description,
      parseArg,
      defaultValue
    );
  }
  /**
   * Alter parsing of short flags with optional values.
   *
   * @example
   * // for `.option('-f,--flag [value]'):
   * program.combineFlagAndOptionalValue(true);  // `-f80` is treated like `--flag=80`, this is the default behaviour
   * program.combineFlagAndOptionalValue(false) // `-fb` is treated like `-f -b`
   *
   * @param {boolean} [combine] - if `true` or omitted, an optional value can be specified directly after the flag.
   * @return {Command} `this` command for chaining
   */
  combineFlagAndOptionalValue(combine = true) {
    this._combineFlagAndOptionalValue = !!combine;
    return this;
  }
  /**
   * Allow unknown options on the command line.
   *
   * @param {boolean} [allowUnknown] - if `true` or omitted, no error will be thrown for unknown options.
   * @return {Command} `this` command for chaining
   */
  allowUnknownOption(allowUnknown = true) {
    this._allowUnknownOption = !!allowUnknown;
    return this;
  }
  /**
   * Allow excess command-arguments on the command line. Pass false to make excess arguments an error.
   *
   * @param {boolean} [allowExcess] - if `true` or omitted, no error will be thrown for excess arguments.
   * @return {Command} `this` command for chaining
   */
  allowExcessArguments(allowExcess = true) {
    this._allowExcessArguments = !!allowExcess;
    return this;
  }
  /**
   * Enable positional options. Positional means global options are specified before subcommands which lets
   * subcommands reuse the same option names, and also enables subcommands to turn on passThroughOptions.
   * The default behaviour is non-positional and global options may appear anywhere on the command line.
   *
   * @param {boolean} [positional]
   * @return {Command} `this` command for chaining
   */
  enablePositionalOptions(positional = true) {
    this._enablePositionalOptions = !!positional;
    return this;
  }
  /**
   * Pass through options that come after command-arguments rather than treat them as command-options,
   * so actual command-options come before command-arguments. Turning this on for a subcommand requires
   * positional options to have been enabled on the program (parent commands).
   * The default behaviour is non-positional and options may appear before or after command-arguments.
   *
   * @param {boolean} [passThrough] for unknown options.
   * @return {Command} `this` command for chaining
   */
  passThroughOptions(passThrough = true) {
    this._passThroughOptions = !!passThrough;
    this._checkForBrokenPassThrough();
    return this;
  }
  /**
   * @private
   */
  _checkForBrokenPassThrough() {
    if (this.parent && this._passThroughOptions && !this.parent._enablePositionalOptions) {
      throw new Error(
        `passThroughOptions cannot be used for '${this._name}' without turning on enablePositionalOptions for parent command(s)`
      );
    }
  }
  /**
   * Whether to store option values as properties on command object,
   * or store separately (specify false). In both cases the option values can be accessed using .opts().
   *
   * @param {boolean} [storeAsProperties=true]
   * @return {Command} `this` command for chaining
   */
  storeOptionsAsProperties(storeAsProperties = true) {
    if (this.options.length) {
      throw new Error("call .storeOptionsAsProperties() before adding options");
    }
    if (Object.keys(this._optionValues).length) {
      throw new Error(
        "call .storeOptionsAsProperties() before setting option values"
      );
    }
    this._storeOptionsAsProperties = !!storeAsProperties;
    return this;
  }
  /**
   * Retrieve option value.
   *
   * @param {string} key
   * @return {object} value
   */
  getOptionValue(key) {
    if (this._storeOptionsAsProperties) {
      return this[key];
    }
    return this._optionValues[key];
  }
  /**
   * Store option value.
   *
   * @param {string} key
   * @param {object} value
   * @return {Command} `this` command for chaining
   */
  setOptionValue(key, value) {
    return this.setOptionValueWithSource(key, value, void 0);
  }
  /**
   * Store option value and where the value came from.
   *
   * @param {string} key
   * @param {object} value
   * @param {string} source - expected values are default/config/env/cli/implied
   * @return {Command} `this` command for chaining
   */
  setOptionValueWithSource(key, value, source) {
    if (this._storeOptionsAsProperties) {
      this[key] = value;
    } else {
      this._optionValues[key] = value;
    }
    this._optionValueSources[key] = source;
    return this;
  }
  /**
   * Get source of option value.
   * Expected values are default | config | env | cli | implied
   *
   * @param {string} key
   * @return {string}
   */
  getOptionValueSource(key) {
    return this._optionValueSources[key];
  }
  /**
   * Get source of option value. See also .optsWithGlobals().
   * Expected values are default | config | env | cli | implied
   *
   * @param {string} key
   * @return {string}
   */
  getOptionValueSourceWithGlobals(key) {
    let source;
    this._getCommandAndAncestors().forEach((cmd) => {
      if (Object.hasOwn(cmd._optionValueSources, key)) {
        source = cmd.getOptionValueSource(key);
      }
    });
    return source;
  }
  /**
   * Get user arguments from implied or explicit arguments.
   * Side-effects: set _scriptPath if args included script. Used for default program name, and subcommand searches.
   *
   * @private
   */
  _prepareUserArgs(argv, parseOptions) {
    if (argv !== void 0 && !Array.isArray(argv)) {
      throw new Error("first parameter to parse must be array or undefined");
    }
    parseOptions = parseOptions || {};
    if (argv === void 0 && parseOptions.from === void 0) {
      if (process2.versions?.electron) {
        parseOptions.from = "electron";
      }
      const execArgv = process2.execArgv ?? [];
      if (execArgv.includes("-e") || execArgv.includes("--eval") || execArgv.includes("-p") || execArgv.includes("--print")) {
        parseOptions.from = "eval";
      }
    }
    if (argv === void 0) {
      argv = process2.argv;
    }
    this.rawArgs = argv.slice();
    let userArgs;
    switch (parseOptions.from) {
      case void 0:
      case "node":
        this._scriptPath = argv[1];
        userArgs = argv.slice(2);
        break;
      case "electron":
        if (process2.defaultApp) {
          this._scriptPath = argv[1];
          userArgs = argv.slice(2);
        } else {
          userArgs = argv.slice(1);
        }
        break;
      case "user":
        userArgs = argv.slice(0);
        break;
      case "eval":
        userArgs = argv.slice(1);
        break;
      default:
        throw new Error(
          `unexpected parse option { from: '${parseOptions.from}' }`
        );
    }
    if (!this._name && this._scriptPath)
      this.nameFromFilename(this._scriptPath);
    this._name = this._name || "program";
    return userArgs;
  }
  /**
   * Parse `argv`, setting options and invoking commands when defined.
   *
   * Use parseAsync instead of parse if any of your action handlers are async.
   *
   * Call with no parameters to parse `process.argv`. Detects Electron and special node options like `node --eval`. Easy mode!
   *
   * Or call with an array of strings to parse, and optionally where the user arguments start by specifying where the arguments are `from`:
   * - `'node'`: default, `argv[0]` is the application and `argv[1]` is the script being run, with user arguments after that
   * - `'electron'`: `argv[0]` is the application and `argv[1]` varies depending on whether the electron application is packaged
   * - `'user'`: just user arguments
   *
   * @example
   * program.parse(); // parse process.argv and auto-detect electron and special node flags
   * program.parse(process.argv); // assume argv[0] is app and argv[1] is script
   * program.parse(my-args, { from: 'user' }); // just user supplied arguments, nothing special about argv[0]
   *
   * @param {string[]} [argv] - optional, defaults to process.argv
   * @param {object} [parseOptions] - optionally specify style of options with from: node/user/electron
   * @param {string} [parseOptions.from] - where the args are from: 'node', 'user', 'electron'
   * @return {Command} `this` command for chaining
   */
  parse(argv, parseOptions) {
    this._prepareForParse();
    const userArgs = this._prepareUserArgs(argv, parseOptions);
    this._parseCommand([], userArgs);
    return this;
  }
  /**
   * Parse `argv`, setting options and invoking commands when defined.
   *
   * Call with no parameters to parse `process.argv`. Detects Electron and special node options like `node --eval`. Easy mode!
   *
   * Or call with an array of strings to parse, and optionally where the user arguments start by specifying where the arguments are `from`:
   * - `'node'`: default, `argv[0]` is the application and `argv[1]` is the script being run, with user arguments after that
   * - `'electron'`: `argv[0]` is the application and `argv[1]` varies depending on whether the electron application is packaged
   * - `'user'`: just user arguments
   *
   * @example
   * await program.parseAsync(); // parse process.argv and auto-detect electron and special node flags
   * await program.parseAsync(process.argv); // assume argv[0] is app and argv[1] is script
   * await program.parseAsync(my-args, { from: 'user' }); // just user supplied arguments, nothing special about argv[0]
   *
   * @param {string[]} [argv]
   * @param {object} [parseOptions]
   * @param {string} parseOptions.from - where the args are from: 'node', 'user', 'electron'
   * @return {Promise}
   */
  async parseAsync(argv, parseOptions) {
    this._prepareForParse();
    const userArgs = this._prepareUserArgs(argv, parseOptions);
    await this._parseCommand([], userArgs);
    return this;
  }
  _prepareForParse() {
    if (this._savedState === null) {
      this.options.filter(
        (option) => option.negate && option.defaultValue === void 0 && this.getOptionValue(option.attributeName()) === void 0
      ).forEach((option) => {
        const positiveLongFlag = option.long.replace(/^--no-/, "--");
        if (!this._findOption(positiveLongFlag)) {
          this.setOptionValueWithSource(
            option.attributeName(),
            true,
            "default"
          );
        }
      });
      this.saveStateBeforeParse();
    } else {
      this.restoreStateBeforeParse();
    }
  }
  /**
   * Called the first time parse is called to save state and allow a restore before subsequent calls to parse.
   * Not usually called directly, but available for subclasses to save their custom state.
   *
   * This is called in a lazy way. Only commands used in parsing chain will have state saved.
   */
  saveStateBeforeParse() {
    this._savedState = {
      // name is stable if supplied by author, but may be unspecified for root command and deduced during parsing
      _name: this._name,
      // option values before parse have default values (including false for negated options)
      // shallow clones
      _optionValues: { ...this._optionValues },
      _optionValueSources: { ...this._optionValueSources }
    };
  }
  /**
   * Restore state before parse for calls after the first.
   * Not usually called directly, but available for subclasses to save their custom state.
   *
   * This is called in a lazy way. Only commands used in parsing chain will have state restored.
   */
  restoreStateBeforeParse() {
    if (this._storeOptionsAsProperties)
      throw new Error(`Can not call parse again when storeOptionsAsProperties is true.
- either make a new Command for each call to parse, or stop storing options as properties`);
    this._name = this._savedState._name;
    this._scriptPath = null;
    this.rawArgs = [];
    this._optionValues = { ...this._savedState._optionValues };
    this._optionValueSources = { ...this._savedState._optionValueSources };
    this.args = [];
    this.processedArgs = [];
  }
  /**
   * Throw if expected executable is missing. Add lots of help for author.
   *
   * @param {string} executableFile
   * @param {string} executableDir
   * @param {string} subcommandName
   */
  _checkForMissingExecutable(executableFile, executableDir, subcommandName) {
    if (fs.existsSync(executableFile)) return;
    const executableDirMessage = executableDir ? `searched for local subcommand relative to directory '${executableDir}'` : "no directory for search for local subcommand, use .executableDir() to supply a custom directory";
    const executableMissing = `'${executableFile}' does not exist
 - if '${subcommandName}' is not meant to be an executable command, remove description parameter from '.command()' and use '.description()' instead
 - if the default executable name is not suitable, use the executableFile option to supply a custom name or path
 - ${executableDirMessage}`;
    throw new Error(executableMissing);
  }
  /**
   * Execute a sub-command executable.
   *
   * @private
   */
  _executeSubCommand(subcommand, args) {
    args = args.slice();
    const sourceExt = [".js", ".ts", ".tsx", ".mjs", ".cjs"];
    function findFile(baseDir, baseName) {
      const localBin = path.resolve(baseDir, baseName);
      if (fs.existsSync(localBin)) return localBin;
      if (sourceExt.includes(path.extname(baseName))) return void 0;
      const foundExt = sourceExt.find(
        (ext) => fs.existsSync(`${localBin}${ext}`)
      );
      if (foundExt) return `${localBin}${foundExt}`;
      return void 0;
    }
    this._checkForMissingMandatoryOptions();
    this._checkForConflictingOptions();
    let executableFile = subcommand._executableFile || `${this._name}-${subcommand._name}`;
    let executableDir = this._executableDir || "";
    if (this._scriptPath) {
      let resolvedScriptPath;
      try {
        resolvedScriptPath = fs.realpathSync(this._scriptPath);
      } catch {
        resolvedScriptPath = this._scriptPath;
      }
      executableDir = path.resolve(
        path.dirname(resolvedScriptPath),
        executableDir
      );
    }
    if (executableDir) {
      let localFile = findFile(executableDir, executableFile);
      if (!localFile && !subcommand._executableFile && this._scriptPath) {
        const legacyName = path.basename(
          this._scriptPath,
          path.extname(this._scriptPath)
        );
        if (legacyName !== this._name) {
          localFile = findFile(
            executableDir,
            `${legacyName}-${subcommand._name}`
          );
        }
      }
      executableFile = localFile || executableFile;
    }
    const launchWithNode = sourceExt.includes(path.extname(executableFile));
    let proc;
    if (process2.platform !== "win32") {
      if (launchWithNode) {
        args.unshift(executableFile);
        args = incrementNodeInspectorPort(process2.execArgv).concat(args);
        proc = childProcess.spawn(process2.argv[0], args, { stdio: "inherit" });
      } else {
        proc = childProcess.spawn(executableFile, args, { stdio: "inherit" });
      }
    } else {
      this._checkForMissingExecutable(
        executableFile,
        executableDir,
        subcommand._name
      );
      args.unshift(executableFile);
      args = incrementNodeInspectorPort(process2.execArgv).concat(args);
      proc = childProcess.spawn(process2.execPath, args, { stdio: "inherit" });
    }
    if (!proc.killed) {
      const signals = ["SIGUSR1", "SIGUSR2", "SIGTERM", "SIGINT", "SIGHUP"];
      signals.forEach((signal) => {
        process2.on(signal, () => {
          if (proc.killed === false && proc.exitCode === null) {
            proc.kill(signal);
          }
        });
      });
    }
    const exitCallback = this._exitCallback;
    proc.on("close", (code) => {
      code = code ?? 1;
      if (!exitCallback) {
        process2.exit(code);
      } else {
        exitCallback(
          new CommanderError(
            code,
            "commander.executeSubCommandAsync",
            "(close)"
          )
        );
      }
    });
    proc.on("error", (err) => {
      if (err.code === "ENOENT") {
        this._checkForMissingExecutable(
          executableFile,
          executableDir,
          subcommand._name
        );
      } else if (err.code === "EACCES") {
        throw new Error(`'${executableFile}' not executable`);
      }
      if (!exitCallback) {
        process2.exit(1);
      } else {
        const wrappedError = new CommanderError(
          1,
          "commander.executeSubCommandAsync",
          "(error)"
        );
        wrappedError.nestedError = err;
        exitCallback(wrappedError);
      }
    });
    this.runningCommand = proc;
  }
  /**
   * @private
   */
  _dispatchSubcommand(commandName, operands, unknown) {
    const subCommand = this._findCommand(commandName);
    if (!subCommand) this.help({ error: true });
    subCommand._prepareForParse();
    let promiseChain;
    promiseChain = this._chainOrCallSubCommandHook(
      promiseChain,
      subCommand,
      "preSubcommand"
    );
    promiseChain = this._chainOrCall(promiseChain, () => {
      if (subCommand._executableHandler) {
        this._executeSubCommand(subCommand, operands.concat(unknown));
      } else {
        return subCommand._parseCommand(operands, unknown);
      }
    });
    return promiseChain;
  }
  /**
   * Invoke help directly if possible, or dispatch if necessary.
   * e.g. help foo
   *
   * @private
   */
  _dispatchHelpCommand(subcommandName) {
    if (!subcommandName) {
      this.help();
    }
    const subCommand = this._findCommand(subcommandName);
    if (subCommand && !subCommand._executableHandler) {
      subCommand.help();
    }
    return this._dispatchSubcommand(
      subcommandName,
      [],
      [this._getHelpOption()?.long ?? this._getHelpOption()?.short ?? "--help"]
    );
  }
  /**
   * Check this.args against expected this.registeredArguments.
   *
   * @private
   */
  _checkNumberOfArguments() {
    this.registeredArguments.forEach((arg, i) => {
      if (arg.required && this.args[i] == null) {
        this.missingArgument(arg.name());
      }
    });
    if (this.registeredArguments.length > 0 && this.registeredArguments[this.registeredArguments.length - 1].variadic) {
      return;
    }
    if (this.args.length > this.registeredArguments.length) {
      this._excessArguments(this.args);
    }
  }
  /**
   * Process this.args using this.registeredArguments and save as this.processedArgs!
   *
   * @private
   */
  _processArguments() {
    const myParseArg = (argument, value, previous) => {
      let parsedValue = value;
      if (value !== null && argument.parseArg) {
        const invalidValueMessage = `error: command-argument value '${value}' is invalid for argument '${argument.name()}'.`;
        parsedValue = this._callParseArg(
          argument,
          value,
          previous,
          invalidValueMessage
        );
      }
      return parsedValue;
    };
    this._checkNumberOfArguments();
    const processedArgs = [];
    this.registeredArguments.forEach((declaredArg, index) => {
      let value = declaredArg.defaultValue;
      if (declaredArg.variadic) {
        if (index < this.args.length) {
          value = this.args.slice(index);
          if (declaredArg.parseArg) {
            value = value.reduce((processed, v) => {
              return myParseArg(declaredArg, v, processed);
            }, declaredArg.defaultValue);
          }
        } else if (value === void 0) {
          value = [];
        }
      } else if (index < this.args.length) {
        value = this.args[index];
        if (declaredArg.parseArg) {
          value = myParseArg(declaredArg, value, declaredArg.defaultValue);
        }
      }
      processedArgs[index] = value;
    });
    this.processedArgs = processedArgs;
  }
  /**
   * Once we have a promise we chain, but call synchronously until then.
   *
   * @param {(Promise|undefined)} promise
   * @param {Function} fn
   * @return {(Promise|undefined)}
   * @private
   */
  _chainOrCall(promise, fn) {
    if (promise?.then && typeof promise.then === "function") {
      return promise.then(() => fn());
    }
    return fn();
  }
  /**
   *
   * @param {(Promise|undefined)} promise
   * @param {string} event
   * @return {(Promise|undefined)}
   * @private
   */
  _chainOrCallHooks(promise, event) {
    let result = promise;
    const hooks = [];
    this._getCommandAndAncestors().reverse().filter((cmd) => cmd._lifeCycleHooks[event] !== void 0).forEach((hookedCommand) => {
      hookedCommand._lifeCycleHooks[event].forEach((callback) => {
        hooks.push({ hookedCommand, callback });
      });
    });
    if (event === "postAction") {
      hooks.reverse();
    }
    hooks.forEach((hookDetail) => {
      result = this._chainOrCall(result, () => {
        return hookDetail.callback(hookDetail.hookedCommand, this);
      });
    });
    return result;
  }
  /**
   *
   * @param {(Promise|undefined)} promise
   * @param {Command} subCommand
   * @param {string} event
   * @return {(Promise|undefined)}
   * @private
   */
  _chainOrCallSubCommandHook(promise, subCommand, event) {
    let result = promise;
    if (this._lifeCycleHooks[event] !== void 0) {
      this._lifeCycleHooks[event].forEach((hook) => {
        result = this._chainOrCall(result, () => {
          return hook(this, subCommand);
        });
      });
    }
    return result;
  }
  /**
   * Process arguments in context of this command.
   * Returns action result, in case it is a promise.
   *
   * @private
   */
  _parseCommand(operands, unknown) {
    const parsed2 = this.parseOptions(unknown);
    this._parseOptionsEnv();
    this._parseOptionsImplied();
    operands = operands.concat(parsed2.operands);
    unknown = parsed2.unknown;
    this.args = operands.concat(unknown);
    if (operands && this._findCommand(operands[0])) {
      return this._dispatchSubcommand(operands[0], operands.slice(1), unknown);
    }
    if (this._getHelpCommand() && operands[0] === this._getHelpCommand().name()) {
      return this._dispatchHelpCommand(operands[1]);
    }
    if (this._defaultCommandName) {
      this._outputHelpIfRequested(unknown);
      return this._dispatchSubcommand(
        this._defaultCommandName,
        operands,
        unknown
      );
    }
    if (this.commands.length && this.args.length === 0 && !this._actionHandler && !this._defaultCommandName) {
      this.help({ error: true });
    }
    this._outputHelpIfRequested(parsed2.unknown);
    this._checkForMissingMandatoryOptions();
    this._checkForConflictingOptions();
    const checkForUnknownOptions = () => {
      if (parsed2.unknown.length > 0) {
        this.unknownOption(parsed2.unknown[0]);
      }
    };
    const commandEvent = `command:${this.name()}`;
    if (this._actionHandler) {
      checkForUnknownOptions();
      this._processArguments();
      let promiseChain;
      promiseChain = this._chainOrCallHooks(promiseChain, "preAction");
      promiseChain = this._chainOrCall(
        promiseChain,
        () => this._actionHandler(this.processedArgs)
      );
      if (this.parent) {
        promiseChain = this._chainOrCall(promiseChain, () => {
          this.parent.emit(commandEvent, operands, unknown);
        });
      }
      promiseChain = this._chainOrCallHooks(promiseChain, "postAction");
      return promiseChain;
    }
    if (this.parent?.listenerCount(commandEvent)) {
      checkForUnknownOptions();
      this._processArguments();
      this.parent.emit(commandEvent, operands, unknown);
    } else if (operands.length) {
      if (this._findCommand("*")) {
        return this._dispatchSubcommand("*", operands, unknown);
      }
      if (this.listenerCount("command:*")) {
        this.emit("command:*", operands, unknown);
      } else if (this.commands.length) {
        this.unknownCommand();
      } else {
        checkForUnknownOptions();
        this._processArguments();
      }
    } else if (this.commands.length) {
      checkForUnknownOptions();
      this.help({ error: true });
    } else {
      checkForUnknownOptions();
      this._processArguments();
    }
  }
  /**
   * Find matching command.
   *
   * @private
   * @return {Command | undefined}
   */
  _findCommand(name) {
    if (!name) return void 0;
    return this.commands.find(
      (cmd) => cmd._name === name || cmd._aliases.includes(name)
    );
  }
  /**
   * Return an option matching `arg` if any.
   *
   * @param {string} arg
   * @return {Option}
   * @package
   */
  _findOption(arg) {
    return this.options.find((option) => option.is(arg));
  }
  /**
   * Display an error message if a mandatory option does not have a value.
   * Called after checking for help flags in leaf subcommand.
   *
   * @private
   */
  _checkForMissingMandatoryOptions() {
    this._getCommandAndAncestors().forEach((cmd) => {
      cmd.options.forEach((anOption) => {
        if (anOption.mandatory && cmd.getOptionValue(anOption.attributeName()) === void 0) {
          cmd.missingMandatoryOptionValue(anOption);
        }
      });
    });
  }
  /**
   * Display an error message if conflicting options are used together in this.
   *
   * @private
   */
  _checkForConflictingLocalOptions() {
    const definedNonDefaultOptions = this.options.filter((option) => {
      const optionKey = option.attributeName();
      if (this.getOptionValue(optionKey) === void 0) {
        return false;
      }
      return this.getOptionValueSource(optionKey) !== "default";
    });
    const optionsWithConflicting = definedNonDefaultOptions.filter(
      (option) => option.conflictsWith.length > 0
    );
    optionsWithConflicting.forEach((option) => {
      const conflictingAndDefined = definedNonDefaultOptions.find(
        (defined) => option.conflictsWith.includes(defined.attributeName())
      );
      if (conflictingAndDefined) {
        this._conflictingOption(option, conflictingAndDefined);
      }
    });
  }
  /**
   * Display an error message if conflicting options are used together.
   * Called after checking for help flags in leaf subcommand.
   *
   * @private
   */
  _checkForConflictingOptions() {
    this._getCommandAndAncestors().forEach((cmd) => {
      cmd._checkForConflictingLocalOptions();
    });
  }
  /**
   * Parse options from `argv` removing known options,
   * and return argv split into operands and unknown arguments.
   *
   * Side effects: modifies command by storing options. Does not reset state if called again.
   *
   * Examples:
   *
   *     argv => operands, unknown
   *     --known kkk op => [op], []
   *     op --known kkk => [op], []
   *     sub --unknown uuu op => [sub], [--unknown uuu op]
   *     sub -- --unknown uuu op => [sub --unknown uuu op], []
   *
   * @param {string[]} args
   * @return {{operands: string[], unknown: string[]}}
   */
  parseOptions(args) {
    const operands = [];
    const unknown = [];
    let dest = operands;
    function maybeOption(arg) {
      return arg.length > 1 && arg[0] === "-";
    }
    const negativeNumberArg = (arg) => {
      if (!/^-(\d+|\d*\.\d+)([eE][+-]?\d+)?$/.test(arg)) return false;
      return !this._getCommandAndAncestors().some(
        (cmd) => cmd.options.map((opt2) => opt2.short).some((short) => /^-\d$/.test(short))
      );
    };
    let activeVariadicOption = null;
    let activeGroup = null;
    let i = 0;
    while (i < args.length || activeGroup) {
      const arg = activeGroup ?? args[i++];
      activeGroup = null;
      if (arg === "--") {
        if (dest === unknown) dest.push(arg);
        dest.push(...args.slice(i));
        break;
      }
      if (activeVariadicOption && (!maybeOption(arg) || negativeNumberArg(arg))) {
        this.emit(`option:${activeVariadicOption.name()}`, arg);
        continue;
      }
      activeVariadicOption = null;
      if (maybeOption(arg)) {
        const option = this._findOption(arg);
        if (option) {
          if (option.required) {
            const value = args[i++];
            if (value === void 0) this.optionMissingArgument(option);
            this.emit(`option:${option.name()}`, value);
          } else if (option.optional) {
            let value = null;
            if (i < args.length && (!maybeOption(args[i]) || negativeNumberArg(args[i]))) {
              value = args[i++];
            }
            this.emit(`option:${option.name()}`, value);
          } else {
            this.emit(`option:${option.name()}`);
          }
          activeVariadicOption = option.variadic ? option : null;
          continue;
        }
      }
      if (arg.length > 2 && arg[0] === "-" && arg[1] !== "-") {
        const option = this._findOption(`-${arg[1]}`);
        if (option) {
          if (option.required || option.optional && this._combineFlagAndOptionalValue) {
            this.emit(`option:${option.name()}`, arg.slice(2));
          } else {
            this.emit(`option:${option.name()}`);
            activeGroup = `-${arg.slice(2)}`;
          }
          continue;
        }
      }
      if (/^--[^=]+=/.test(arg)) {
        const index = arg.indexOf("=");
        const option = this._findOption(arg.slice(0, index));
        if (option && (option.required || option.optional)) {
          this.emit(`option:${option.name()}`, arg.slice(index + 1));
          continue;
        }
      }
      if (dest === operands && maybeOption(arg) && !(this.commands.length === 0 && negativeNumberArg(arg))) {
        dest = unknown;
      }
      if ((this._enablePositionalOptions || this._passThroughOptions) && operands.length === 0 && unknown.length === 0) {
        if (this._findCommand(arg)) {
          operands.push(arg);
          unknown.push(...args.slice(i));
          break;
        } else if (this._getHelpCommand() && arg === this._getHelpCommand().name()) {
          operands.push(arg, ...args.slice(i));
          break;
        } else if (this._defaultCommandName) {
          unknown.push(arg, ...args.slice(i));
          break;
        }
      }
      if (this._passThroughOptions) {
        dest.push(arg, ...args.slice(i));
        break;
      }
      dest.push(arg);
    }
    return { operands, unknown };
  }
  /**
   * Return an object containing local option values as key-value pairs.
   *
   * @return {object}
   */
  opts() {
    if (this._storeOptionsAsProperties) {
      const result = {};
      const len = this.options.length;
      for (let i = 0; i < len; i++) {
        const key = this.options[i].attributeName();
        result[key] = key === this._versionOptionName ? this._version : this[key];
      }
      return result;
    }
    return this._optionValues;
  }
  /**
   * Return an object containing merged local and global option values as key-value pairs.
   *
   * @return {object}
   */
  optsWithGlobals() {
    return this._getCommandAndAncestors().reduce(
      (combinedOptions, cmd) => Object.assign(combinedOptions, cmd.opts()),
      {}
    );
  }
  /**
   * Display error message and exit (or call exitOverride).
   *
   * @param {string} message
   * @param {object} [errorOptions]
   * @param {string} [errorOptions.code] - an id string representing the error
   * @param {number} [errorOptions.exitCode] - used with process.exit
   */
  error(message, errorOptions) {
    this._outputConfiguration.outputError(
      `${message}
`,
      this._outputConfiguration.writeErr
    );
    if (typeof this._showHelpAfterError === "string") {
      this._outputConfiguration.writeErr(`${this._showHelpAfterError}
`);
    } else if (this._showHelpAfterError) {
      this._outputConfiguration.writeErr("\n");
      this.outputHelp({ error: true });
    }
    const config = errorOptions || {};
    const exitCode = config.exitCode || 1;
    const code = config.code || "commander.error";
    this._exit(exitCode, code, message);
  }
  /**
   * Apply any option related environment variables, if option does
   * not have a value from cli or client code.
   *
   * @private
   */
  _parseOptionsEnv() {
    this.options.forEach((option) => {
      if (option.envVar && option.envVar in process2.env) {
        const optionKey = option.attributeName();
        if (this.getOptionValue(optionKey) === void 0 || ["default", "config", "env"].includes(
          this.getOptionValueSource(optionKey)
        )) {
          if (option.required || option.optional) {
            this.emit(`optionEnv:${option.name()}`, process2.env[option.envVar]);
          } else {
            this.emit(`optionEnv:${option.name()}`);
          }
        }
      }
    });
  }
  /**
   * Apply any implied option values, if option is undefined or default value.
   *
   * @private
   */
  _parseOptionsImplied() {
    const dualHelper = new DualOptions(this.options);
    const hasCustomOptionValue = (optionKey) => {
      return this.getOptionValue(optionKey) !== void 0 && !["default", "implied"].includes(this.getOptionValueSource(optionKey));
    };
    this.options.filter(
      (option) => option.implied !== void 0 && hasCustomOptionValue(option.attributeName()) && dualHelper.valueFromOption(
        this.getOptionValue(option.attributeName()),
        option
      )
    ).forEach((option) => {
      Object.keys(option.implied).filter((impliedKey) => !hasCustomOptionValue(impliedKey)).forEach((impliedKey) => {
        this.setOptionValueWithSource(
          impliedKey,
          option.implied[impliedKey],
          "implied"
        );
      });
    });
  }
  /**
   * Argument `name` is missing.
   *
   * @param {string} name
   * @private
   */
  missingArgument(name) {
    const message = `error: missing required argument '${name}'`;
    this.error(message, { code: "commander.missingArgument" });
  }
  /**
   * `Option` is missing an argument.
   *
   * @param {Option} option
   * @private
   */
  optionMissingArgument(option) {
    const message = `error: option '${option.flags}' argument missing`;
    this.error(message, { code: "commander.optionMissingArgument" });
  }
  /**
   * `Option` does not have a value, and is a mandatory option.
   *
   * @param {Option} option
   * @private
   */
  missingMandatoryOptionValue(option) {
    const message = `error: required option '${option.flags}' not specified`;
    this.error(message, { code: "commander.missingMandatoryOptionValue" });
  }
  /**
   * `Option` conflicts with another option.
   *
   * @param {Option} option
   * @param {Option} conflictingOption
   * @private
   */
  _conflictingOption(option, conflictingOption) {
    const findBestOptionFromValue = (option2) => {
      const optionKey = option2.attributeName();
      const optionValue = this.getOptionValue(optionKey);
      const negativeOption = this.options.find(
        (target) => target.negate && optionKey === target.attributeName()
      );
      const positiveOption = this.options.find(
        (target) => !target.negate && optionKey === target.attributeName()
      );
      if (negativeOption && (negativeOption.presetArg === void 0 && optionValue === false || negativeOption.presetArg !== void 0 && optionValue === negativeOption.presetArg)) {
        return negativeOption;
      }
      return positiveOption || option2;
    };
    const getErrorMessage = (option2) => {
      const bestOption = findBestOptionFromValue(option2);
      const optionKey = bestOption.attributeName();
      const source = this.getOptionValueSource(optionKey);
      if (source === "env") {
        return `environment variable '${bestOption.envVar}'`;
      }
      return `option '${bestOption.flags}'`;
    };
    const message = `error: ${getErrorMessage(option)} cannot be used with ${getErrorMessage(conflictingOption)}`;
    this.error(message, { code: "commander.conflictingOption" });
  }
  /**
   * Unknown option `flag`.
   *
   * @param {string} flag
   * @private
   */
  unknownOption(flag) {
    if (this._allowUnknownOption) return;
    let suggestion = "";
    if (flag.startsWith("--") && this._showSuggestionAfterError) {
      let candidateFlags = [];
      let command = this;
      do {
        const moreFlags = command.createHelp().visibleOptions(command).filter((option) => option.long).map((option) => option.long);
        candidateFlags = candidateFlags.concat(moreFlags);
        command = command.parent;
      } while (command && !command._enablePositionalOptions);
      suggestion = suggestSimilar(flag, candidateFlags);
    }
    const message = `error: unknown option '${flag}'${suggestion}`;
    this.error(message, { code: "commander.unknownOption" });
  }
  /**
   * Excess arguments, more than expected.
   *
   * @param {string[]} receivedArgs
   * @private
   */
  _excessArguments(receivedArgs) {
    if (this._allowExcessArguments) return;
    const expected = this.registeredArguments.length;
    const s = expected === 1 ? "" : "s";
    const received = receivedArgs.length;
    const forSubcommand = this.parent ? ` for '${this.name()}'` : "";
    const details = receivedArgs.join(", ");
    const message = `error: too many arguments${forSubcommand}. Expected ${expected} argument${s} but got ${received}: ${details}.`;
    this.error(message, { code: "commander.excessArguments" });
  }
  /**
   * Unknown command.
   *
   * @private
   */
  unknownCommand() {
    const unknownName = this.args[0];
    let suggestion = "";
    if (this._showSuggestionAfterError) {
      const candidateNames = [];
      this.createHelp().visibleCommands(this).forEach((command) => {
        candidateNames.push(command.name());
        if (command.alias()) candidateNames.push(command.alias());
      });
      suggestion = suggestSimilar(unknownName, candidateNames);
    }
    const message = `error: unknown command '${unknownName}'${suggestion}`;
    this.error(message, { code: "commander.unknownCommand" });
  }
  /**
   * Get or set the program version.
   *
   * This method auto-registers the "-V, --version" option which will print the version number.
   *
   * You can optionally supply the flags and description to override the defaults.
   *
   * @param {string} [str]
   * @param {string} [flags]
   * @param {string} [description]
   * @return {(this | string | undefined)} `this` command for chaining, or version string if no arguments
   */
  version(str, flags, description) {
    if (str === void 0) return this._version;
    this._version = str;
    flags = flags || "-V, --version";
    description = description || "output the version number";
    const versionOption = this.createOption(flags, description);
    this._versionOptionName = versionOption.attributeName();
    this._registerOption(versionOption);
    this.on("option:" + versionOption.name(), () => {
      this._outputConfiguration.writeOut(`${str}
`);
      this._exit(0, "commander.version", str);
    });
    return this;
  }
  /**
   * Set the description.
   *
   * @param {string} [str]
   * @param {object} [argsDescription]
   * @return {(string|Command)}
   */
  description(str, argsDescription) {
    if (str === void 0 && argsDescription === void 0)
      return this._description;
    this._description = str;
    if (argsDescription) {
      this._argsDescription = argsDescription;
    }
    return this;
  }
  /**
   * Set the summary. Used when listed as subcommand of parent.
   *
   * @param {string} [str]
   * @return {(string|Command)}
   */
  summary(str) {
    if (str === void 0) return this._summary;
    this._summary = str;
    return this;
  }
  /**
   * Set an alias for the command.
   *
   * You may call more than once to add multiple aliases. Only the first alias is shown in the auto-generated help.
   *
   * @param {string} [alias]
   * @return {(string|Command)}
   */
  alias(alias) {
    if (alias === void 0) return this._aliases[0];
    let command = this;
    if (this.commands.length !== 0 && this.commands[this.commands.length - 1]._executableHandler) {
      command = this.commands[this.commands.length - 1];
    }
    if (alias === command._name)
      throw new Error("Command alias can't be the same as its name");
    const matchingCommand = this.parent?._findCommand(alias);
    if (matchingCommand) {
      const existingCmd = [matchingCommand.name()].concat(matchingCommand.aliases()).join("|");
      throw new Error(
        `cannot add alias '${alias}' to command '${this.name()}' as already have command '${existingCmd}'`
      );
    }
    command._aliases.push(alias);
    return this;
  }
  /**
   * Set aliases for the command.
   *
   * Only the first alias is shown in the auto-generated help.
   *
   * @param {string[]} [aliases]
   * @return {(string[]|Command)}
   */
  aliases(aliases) {
    if (aliases === void 0) return this._aliases;
    aliases.forEach((alias) => this.alias(alias));
    return this;
  }
  /**
   * Set / get the command usage `str`.
   *
   * @param {string} [str]
   * @return {(string|Command)}
   */
  usage(str) {
    if (str === void 0) {
      if (this._usage) return this._usage;
      const args = this.registeredArguments.map((arg) => {
        return humanReadableArgName(arg);
      });
      return [].concat(
        this.options.length || this._helpOption !== null ? "[options]" : [],
        this.commands.length ? "[command]" : [],
        this.registeredArguments.length ? args : []
      ).join(" ");
    }
    this._usage = str;
    return this;
  }
  /**
   * Get or set the name of the command.
   *
   * @param {string} [str]
   * @return {(string|Command)}
   */
  name(str) {
    if (str === void 0) return this._name;
    this._name = str;
    return this;
  }
  /**
   * Set/get the help group heading for this subcommand in parent command's help.
   *
   * @param {string} [heading]
   * @return {Command | string}
   */
  helpGroup(heading) {
    if (heading === void 0) return this._helpGroupHeading ?? "";
    this._helpGroupHeading = heading;
    return this;
  }
  /**
   * Set/get the default help group heading for subcommands added to this command.
   * (This does not override a group set directly on the subcommand using .helpGroup().)
   *
   * @example
   * program.commandsGroup('Development Commands:');
   * program.command('watch')...
   * program.command('lint')...
   * ...
   *
   * @param {string} [heading]
   * @returns {Command | string}
   */
  commandsGroup(heading) {
    if (heading === void 0) return this._defaultCommandGroup ?? "";
    this._defaultCommandGroup = heading;
    return this;
  }
  /**
   * Set/get the default help group heading for options added to this command.
   * (This does not override a group set directly on the option using .helpGroup().)
   *
   * @example
   * program
   *   .optionsGroup('Development Options:')
   *   .option('-d, --debug', 'output extra debugging')
   *   .option('-p, --profile', 'output profiling information')
   *
   * @param {string} [heading]
   * @returns {Command | string}
   */
  optionsGroup(heading) {
    if (heading === void 0) return this._defaultOptionGroup ?? "";
    this._defaultOptionGroup = heading;
    return this;
  }
  /**
   * @param {Option} option
   * @private
   */
  _initOptionGroup(option) {
    if (this._defaultOptionGroup && !option.helpGroupHeading)
      option.helpGroup(this._defaultOptionGroup);
  }
  /**
   * @param {Command} cmd
   * @private
   */
  _initCommandGroup(cmd) {
    if (this._defaultCommandGroup && !cmd.helpGroup())
      cmd.helpGroup(this._defaultCommandGroup);
  }
  /**
   * Set the name of the command from script filename, such as process.argv[1],
   * or import.meta.filename.
   *
   * (Used internally and public although not documented in README.)
   *
   * @example
   * program.nameFromFilename(import.meta.filename);
   *
   * @param {string} filename
   * @return {Command}
   */
  nameFromFilename(filename) {
    this._name = path.basename(filename, path.extname(filename));
    return this;
  }
  /**
   * Get or set the directory for searching for executable subcommands of this command.
   *
   * @example
   * program.executableDir(import.meta.dirname);
   * // or
   * program.executableDir('subcommands');
   *
   * @param {string} [path]
   * @return {(string|null|Command)}
   */
  executableDir(path2) {
    if (path2 === void 0) return this._executableDir;
    this._executableDir = path2;
    return this;
  }
  /**
   * Return program help documentation.
   *
   * @param {{ error: boolean }} [contextOptions] - pass {error:true} to wrap for stderr instead of stdout
   * @return {string}
   */
  helpInformation(contextOptions) {
    const helper = this.createHelp();
    const context = this._getOutputContext(contextOptions);
    helper.prepareContext({
      error: context.error,
      helpWidth: context.helpWidth,
      outputHasColors: context.hasColors
    });
    const text = helper.formatHelp(this, helper);
    if (context.hasColors) return text;
    return this._outputConfiguration.stripColor(text);
  }
  /**
   * @typedef HelpContext
   * @type {object}
   * @property {boolean} error
   * @property {number} helpWidth
   * @property {boolean} hasColors
   * @property {function} write - includes stripColor if needed
   *
   * @returns {HelpContext}
   * @private
   */
  _getOutputContext(contextOptions) {
    contextOptions = contextOptions || {};
    const error = !!contextOptions.error;
    let baseWrite;
    let hasColors;
    let helpWidth;
    if (error) {
      baseWrite = (str) => this._outputConfiguration.writeErr(str);
      hasColors = this._outputConfiguration.getErrHasColors();
      helpWidth = this._outputConfiguration.getErrHelpWidth();
    } else {
      baseWrite = (str) => this._outputConfiguration.writeOut(str);
      hasColors = this._outputConfiguration.getOutHasColors();
      helpWidth = this._outputConfiguration.getOutHelpWidth();
    }
    const write = (str) => {
      if (!hasColors) str = this._outputConfiguration.stripColor(str);
      return baseWrite(str);
    };
    return { error, write, hasColors, helpWidth };
  }
  /**
   * Output help information for this command.
   *
   * Outputs built-in help, and custom text added using `.addHelpText()`.
   *
   * @param {{ error: boolean } | Function} [contextOptions] - pass {error:true} to write to stderr instead of stdout
   */
  outputHelp(contextOptions) {
    let deprecatedCallback;
    if (typeof contextOptions === "function") {
      deprecatedCallback = contextOptions;
      contextOptions = void 0;
    }
    const outputContext = this._getOutputContext(contextOptions);
    const eventContext = {
      error: outputContext.error,
      write: outputContext.write,
      command: this
    };
    this._getCommandAndAncestors().reverse().forEach((command) => command.emit("beforeAllHelp", eventContext));
    this.emit("beforeHelp", eventContext);
    let helpInformation = this.helpInformation({ error: outputContext.error });
    if (deprecatedCallback) {
      helpInformation = deprecatedCallback(helpInformation);
      if (typeof helpInformation !== "string" && !Buffer.isBuffer(helpInformation)) {
        throw new Error("outputHelp callback must return a string or a Buffer");
      }
    }
    outputContext.write(helpInformation);
    if (this._getHelpOption()?.long) {
      this.emit(this._getHelpOption().long);
    }
    this.emit("afterHelp", eventContext);
    this._getCommandAndAncestors().forEach(
      (command) => command.emit("afterAllHelp", eventContext)
    );
  }
  /**
   * You can pass in flags and a description to customise the built-in help option.
   * Pass in false to disable the built-in help option.
   *
   * @example
   * program.helpOption('-?, --help', 'show help'); // customise
   * program.helpOption(false); // disable
   *
   * @param {(string | boolean)} flags
   * @param {string} [description]
   * @return {Command} `this` command for chaining
   */
  helpOption(flags, description) {
    if (typeof flags === "boolean") {
      if (flags) {
        if (this._helpOption === null) this._helpOption = void 0;
        if (this._defaultOptionGroup) {
          this._initOptionGroup(this._getHelpOption());
        }
      } else {
        this._helpOption = null;
      }
      return this;
    }
    this._helpOption = this.createOption(
      flags ?? "-h, --help",
      description ?? "display help for command"
    );
    if (flags || description) this._initOptionGroup(this._helpOption);
    return this;
  }
  /**
   * Lazy create help option.
   * Returns null if has been disabled with .helpOption(false).
   *
   * @returns {(Option | null)} the help option
   * @package
   */
  _getHelpOption() {
    if (this._helpOption === void 0) {
      this.helpOption(void 0, void 0);
    }
    return this._helpOption;
  }
  /**
   * Supply your own option to use for the built-in help option.
   * This is an alternative to using helpOption() to customise the flags and description etc.
   *
   * @param {Option} option
   * @return {Command} `this` command for chaining
   */
  addHelpOption(option) {
    this._helpOption = option;
    this._initOptionGroup(option);
    return this;
  }
  /**
   * Output help information and exit.
   *
   * Outputs built-in help, and custom text added using `.addHelpText()`.
   *
   * @param {{ error: boolean }} [contextOptions] - pass {error:true} to write to stderr instead of stdout
   */
  help(contextOptions) {
    this.outputHelp(contextOptions);
    let exitCode = Number(process2.exitCode ?? 0);
    if (exitCode === 0 && contextOptions && typeof contextOptions !== "function" && contextOptions.error) {
      exitCode = 1;
    }
    this._exit(exitCode, "commander.help", "(outputHelp)");
  }
  /**
   * // Do a little typing to coordinate emit and listener for the help text events.
   * @typedef HelpTextEventContext
   * @type {object}
   * @property {boolean} error
   * @property {Command} command
   * @property {function} write
   */
  /**
   * Add additional text to be displayed with the built-in help.
   *
   * Position is 'before' or 'after' to affect just this command,
   * and 'beforeAll' or 'afterAll' to affect this command and all its subcommands.
   *
   * @param {string} position - before or after built-in help
   * @param {(string | Function)} text - string to add, or a function returning a string
   * @return {Command} `this` command for chaining
   */
  addHelpText(position, text) {
    const allowedValues = ["beforeAll", "before", "after", "afterAll"];
    if (!allowedValues.includes(position)) {
      throw new Error(`Unexpected value for position to addHelpText.
Expecting one of '${allowedValues.join("', '")}'`);
    }
    const helpEvent = `${position}Help`;
    this.on(helpEvent, (context) => {
      let helpStr;
      if (typeof text === "function") {
        helpStr = text({ error: context.error, command: context.command });
      } else {
        helpStr = text;
      }
      if (helpStr) {
        context.write(`${helpStr}
`);
      }
    });
    return this;
  }
  /**
   * Output help information if help flags specified
   *
   * @param {Array} args - array of options to search for help flags
   * @private
   */
  _outputHelpIfRequested(args) {
    const helpOption = this._getHelpOption();
    const helpRequested = helpOption && args.find((arg) => helpOption.is(arg));
    if (helpRequested) {
      this.outputHelp();
      this._exit(0, "commander.helpDisplayed", "(outputHelp)");
    }
  }
};
function incrementNodeInspectorPort(args) {
  return args.map((arg) => {
    if (!arg.startsWith("--inspect")) {
      return arg;
    }
    let debugOption;
    let debugHost = "127.0.0.1";
    let debugPort = "9229";
    let match;
    if ((match = arg.match(/^(--inspect(-brk|-wait)?)$/)) !== null) {
      debugOption = match[1];
    } else if ((match = arg.match(
      /^(--inspect(-brk|-port|-wait)?)=(\[[^\]]+\]|[^:]+)$/
    )) !== null) {
      debugOption = match[1];
      if (/^\d+$/.test(match[3])) {
        debugPort = match[3];
      } else {
        debugHost = match[3];
      }
    } else if ((match = arg.match(
      /^(--inspect(-brk|-port|-wait)?)=(\[[^\]]+\]|[^:]+):(\d+)$/
    )) !== null) {
      debugOption = match[1];
      debugHost = match[3];
      debugPort = match[4];
    }
    if (debugOption && debugPort !== "0") {
      return `${debugOption}=${debugHost}:${parseInt(debugPort) + 1}`;
    }
    return arg;
  });
}
function useColor() {
  if (process2.env.NO_COLOR || process2.env.FORCE_COLOR === "0" || process2.env.FORCE_COLOR === "false")
    return false;
  if (process2.env.FORCE_COLOR || process2.env.CLICOLOR_FORCE !== void 0)
    return true;
  return void 0;
}

// ../../node_modules/.pnpm/commander@15.1.0/node_modules/commander/index.js
var program = new Command();

// ../core/dist/types.js
var PHASES = ["brief", "requirements", "design", "tasks", "execute", "done"];

// ../core/dist/ids.js
var REQ_ID = /^R(\d+)$/;
var CRIT_ID = /^R(\d+)\.(\d+)$/;
var DESIGN_ID = /^D-[A-Za-z0-9][\w-]*$/;
var TASK_ID = /^T?(\d+(?:\.\d+)*)$/;
function kindOf(id) {
  if (CRIT_ID.test(id))
    return "criterion";
  if (REQ_ID.test(id))
    return "requirement";
  if (DESIGN_ID.test(id))
    return "design";
  if (TASK_ID.test(id))
    return "task";
  return "unknown";
}
function normTaskId(id) {
  const m = TASK_ID.exec(id.trim());
  return m ? `T${m[1]}` : id.trim();
}
function normReqId(id) {
  const s = id.trim();
  if (/^\d+(\.\d+)?$/.test(s))
    return `R${s}`;
  return s;
}
function reqOf(id) {
  const m = CRIT_ID.exec(id);
  return m ? `R${m[1]}` : id;
}

// ../core/dist/tokens.js
function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

// ../core/dist/source.js
import { existsSync, readdirSync, readFileSync } from "node:fs";
var BOM = "\uFEFF";
var utf8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
function decodeText(raw) {
  return raw.startsWith(BOM) ? { text: raw.slice(1), bom: true } : { text: raw, bom: false };
}
var isMissing = (e) => e?.code === "ENOENT" || e?.code === "ENOTDIR";
var diskSource = {
  read(path2) {
    let bytes;
    try {
      bytes = readFileSync(path2);
    } catch (e) {
      if (isMissing(e))
        return void 0;
      return { error: `cannot be opened (${e.code ?? e.message})` };
    }
    try {
      return decodeText(utf8.decode(bytes));
    } catch {
      return { error: "is not UTF-8 text" };
    }
  },
  list(dir) {
    try {
      return readdirSync(dir).sort();
    } catch {
      return [];
    }
  }
};

// ../core/dist/config.js
var import_yaml = __toESM(require_dist(), 1);
import { existsSync as existsSync2, readFileSync as readFileSync2, writeFileSync, mkdirSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

// ../core/dist/templates.js
function requirementsTemplate(title) {
  return `# Requirements Document

## Introduction

<2 short paragraphs: the situation today, and what ${title} changes. No solution details.>

## Glossary

- **Term_Name**: <definition; use Term_Name in criteria instead of prose>

## Requirements

### Requirement 1: <short name>

**User Story:** As a <role>, I want <capability>, so that <benefit>.

#### Acceptance Criteria

1. WHEN <trigger>, THE <Component> SHALL <response>.
2. IF <unwanted condition>, THEN THE <Component> SHALL <response>.
3. WHILE <state>, THE <Component> SHALL <response>.
4. WHERE <option or mode>, THE <Component> SHALL <response>.
5. THE <Component> SHALL <always-true behaviour>.
`;
}
function bugfixTemplate(title) {
  return `# Bugfix Document

## Introduction

<what is broken, who hits it, and the impact>

## Glossary

- **Term_Name**: <definition>

## Current Behavior

<what happens now, with exact repro steps>

## Expected Behavior

<what should happen>

## Unchanged Behavior

<what must keep working exactly as today>

## Requirements

### Requirement 1: <bug summary>

**User Story:** As a <role>, I want <correct behaviour>, so that <benefit>.

#### Acceptance Criteria

1. WHEN <repro trigger>, THE <Component> SHALL <correct response>.
2. WHILE <unchanged scenario>, THE <Component> SHALL <behave as before>.
`;
}
function designTemplate(title) {
  return `# Design \u2014 ${title}

## Overview
<one paragraph: what changes and why; no footer here>

## Architecture {#D-arch}
<one diagram (mermaid) or a short bullet flow naming the components and the data they pass>

## Components and Interfaces
### <Component> {#D-component}
_Satisfies: 1.1, 1.2_
- Responsibility: <one line>
- File: \`src/<path>\`
- Interface: <signature or props, \u2264 10 lines in a code block if needed; no implementation bodies>
- Behaviour: <bullets, one per criterion it satisfies>

## Data Models {#D-data}
_Satisfies: <criteria that need these fields>_
| Field | Source | Used by |
|---|---|---|

## Correctness Properties
### Property 1: <invariant in one sentence> {#D-prop-1}
_Validates: 1.2_
*For any* <inputs>, <what must hold>.

## Error Handling {#D-errors}
_Satisfies: <criteria about failures and fallbacks>_
<bullets: failure case \u2192 user-visible result>

## Testing Strategy
<no footer; a table mapping criteria ranges \u2192 test type and file; property tests for the properties above>
`;
}
function tasksTemplate(title) {
  return `# Tasks \u2014 ${title}

- [ ] 1. <group>
  - [ ] 1.1 <concrete step, one sitting of work>
    - _Requirements: 1.1_ _Design: D-component_
  - [ ]* 1.2 <optional step, e.g. extra tests>
    - _Requirements: 1.2_
- [ ] 2. Checkpoint \u2014 <surface> end to end
  Verify: <type check, test command, and the user-visible flows to try>. No footer needed.
`;
}
function requestLine(description) {
  const text = (description ?? "").replace(/\s+/g, " ").trim();
  return text ? `> Request: ${text}` : void 0;
}
function withRequest(template, line) {
  if (!line)
    return template;
  const at = template.search(/^## .*$/m);
  if (at < 0)
    return template;
  const end = template.indexOf("\n", at);
  const head = end < 0 ? template : template.slice(0, end);
  const rest = end < 0 ? "" : template.slice(end + 1).replace(/^\n+/, "");
  return `${head}

${line}

${rest}`;
}
function briefTemplate(title) {
  return `# Concept Brief \u2014 ${title}

## Problem
## Proposed direction
## Alternatives considered
## Open questions
## Decision
`;
}
function configTemplate() {
  return `# steno project config
specsDir: .steno/specs
steeringDir: .steno/steering   # set to .kiro/steering to share steering with Kiro
ctxBudget: 1500          # tokens per \`steno ctx\` packet
steeringBudget: 4000     # token cap for all \`inclusion: always\` steering combined; read in full when a spec starts, trimmed in task packets
reviewer: default        # default | egm. default uses steno's own reviewers; egm hands reviews to EGM if it is installed
agents: []               # filled by \`steno init --agent ...\`
`;
}

// ../core/dist/contract.js
var PROTOCOL_VERSION = 1;
var ERROR_CODES = [
  "not-set-up",
  "invalid-request",
  "not-found",
  "unsupported",
  "unsaved-edits",
  "lint-blocked",
  "unreadable",
  "failed"
];
var req = (type) => ({ type });
var opt = (type) => ({ type, optional: true });
var PHASE = { enum: ["brief", "requirements", "design", "tasks", "execute", "done"] };
var V = req("number");
var CONTRACT = {
  protocolVersion: PROTOCOL_VERSION,
  errorCodes: ERROR_CODES,
  lensCommands: ["steno.task.run", "steno.task.done"],
  shapes: {
    Handshake: {
      serverInfo: req({ object: { name: req({ enum: ["steno"] }), version: req("string") } }),
      capabilities: req({ object: { experimental: req({ object: { steno: req({ object: { protocolVersion: V } }) } }) } })
    },
    SpecTree: {
      protocolVersion: V,
      notSetUp: opt("true"),
      specs: req({ array: { ref: "TreeSpec" } }),
      steering: req({ array: { ref: "TreeSteering" } }),
      specsDir: opt("string"),
      steeringDir: opt("string")
    },
    TreeSpec: {
      name: req("string"),
      title: opt("string"),
      kind: opt({ enum: ["feature", "bugfix"] }),
      mode: opt({ enum: ["gated", "quick"] }),
      phase: opt(PHASE),
      approvals: opt({ keys: ["requirements", "design", "tasks"], value: { nullable: "string" } }),
      tasks: opt({ ref: "TaskCounts" }),
      next: opt({ nullable: { object: { id: req("string"), title: req("string") } } }),
      documents: opt({ array: "string" }),
      taskItems: opt({ array: { ref: "OutlineItem" } }),
      written: opt("true"),
      unsupported: opt("true"),
      unreadable: opt("true"),
      files: opt({ array: { object: { file: req("string"), reason: req("string") } } })
    },
    TaskCounts: { total: req("number"), done: req("number"), optionalTotal: req("number"), optionalDone: req("number") },
    TreeSteering: {
      path: req("string"),
      inclusion: opt({ enum: ["always", "fileMatch", "manual"] }),
      pattern: opt("string"),
      unreadable: opt("true"),
      reason: opt("string")
    },
    TaskPacket: {
      protocolVersion: V,
      spec: req("string"),
      task: req("string"),
      text: req("string"),
      tokens: req("number"),
      budget: req("number"),
      files: req({ array: "string" }),
      trimmed: req({ array: "string" })
    },
    ChangeResult: {
      protocolVersion: V,
      spec: req("string"),
      phase: req(PHASE),
      task: opt("string"),
      done: opt("boolean"),
      approved: opt(PHASE),
      forced: opt("true"),
      created: opt({ array: "string" })
    },
    DiagnosticList: { protocolVersion: V, spec: opt("string"), diagnostics: req({ array: { ref: "Diagnostic" } }) },
    Diagnostic: {
      file: req("string"),
      line: req("number"),
      severity: req({ enum: ["error", "warning"] }),
      rule: req("string"),
      message: req("string"),
      spec: opt("string")
    },
    Outline: { protocolVersion: V, spec: req("string"), document: req("string"), items: req({ array: { ref: "OutlineItem" } }) },
    OutlineItem: {
      kind: req({ enum: ["requirement", "criterion", "section", "task", "heading"] }),
      id: opt("string"),
      title: req("string"),
      line: req("number"),
      endLine: req("number"),
      children: req({ array: { ref: "OutlineItem" } }),
      done: opt("boolean"),
      optional: opt("boolean")
    },
    StructuredError: {
      protocolVersion: V,
      code: req({ enum: ERROR_CODES }),
      message: req("string"),
      field: opt("string"),
      file: opt("string"),
      spec: opt("string"),
      reason: opt("string"),
      findings: opt({ array: { ref: "Diagnostic" } })
    }
  }
};
var StenoError = class extends Error {
  code;
  field;
  file;
  spec;
  reason;
  findings;
  constructor(code, message, info = {}) {
    super(message);
    this.name = "StenoError";
    this.code = code;
    for (const k of ["field", "file", "spec", "reason", "findings"])
      if (info[k] !== void 0)
        this[k] = info[k];
  }
};
function toStructuredError(err) {
  if (!(err instanceof StenoError))
    return { protocolVersion: PROTOCOL_VERSION, code: "failed", message: err instanceof Error ? err.message : String(err) };
  const out2 = { protocolVersion: PROTOCOL_VERSION, code: err.code, message: err.message };
  if (err.field !== void 0)
    out2.field = err.field;
  if (err.file !== void 0)
    out2.file = err.file;
  if (err.spec !== void 0)
    out2.spec = err.spec;
  if (err.reason !== void 0)
    out2.reason = err.reason;
  if (err.findings !== void 0)
    out2.findings = err.findings;
  return out2;
}

// ../core/dist/config.js
var DEFAULT_CONFIG = { specsDir: ".steno/specs", steeringDir: ".steno/steering", ctxBudget: 1500, steeringBudget: 4e3, reviewer: "default", agents: [] };
function findProjectRoot(from = process.cwd()) {
  let dir = resolve(from);
  for (; ; ) {
    if (existsSync2(join(dir, ".steno")))
      return dir;
    const up = dirname(dir);
    if (up === dir)
      return resolve(from);
    dir = up;
  }
}
function configPath(root) {
  return join(root, ".steno", "config.yaml");
}
var isPosInt = (v) => typeof v === "number" && Number.isInteger(v) && v > 0;
var isFolder = (v) => typeof v === "string" && v.trim() !== "";
var ACCEPTS = {
  specsDir: isFolder,
  steeringDir: isFolder,
  ctxBudget: isPosInt,
  steeringBudget: isPosInt,
  reviewer: (v) => v === "default" || v === "egm",
  agents: (v) => Array.isArray(v) && v.every((a) => typeof a === "string")
};
var outside = (root, dir) => {
  const rel2 = relative(resolve(root), resolve(root, dir));
  return rel2.startsWith("..") || isAbsolute(rel2);
};
function readConfig(root, src = diskSource) {
  const config = { ...DEFAULT_CONFIG, agents: [...DEFAULT_CONFIG.agents] };
  const warnings = [];
  const unreadable = (reason) => ({ config: { ...DEFAULT_CONFIG, agents: [] }, warnings: [], unreadable: reason });
  const r = src.read(configPath(root));
  if (!r)
    return { config, warnings };
  if ("error" in r)
    return unreadable(`.steno/config.yaml ${r.error}`);
  const lineCounter = new import_yaml.LineCounter();
  const doc = import_yaml.default.parseDocument(r.text, { lineCounter });
  if (doc.errors.length)
    return unreadable(`.steno/config.yaml is not valid YAML: ${doc.errors[0].message.split("\n")[0]}`);
  if (doc.contents == null || (0, import_yaml.isScalar)(doc.contents) && doc.contents.value == null)
    return { config, warnings };
  if (!(0, import_yaml.isMap)(doc.contents))
    return unreadable(".steno/config.yaml is not a mapping");
  for (const pair of doc.contents.items) {
    const key = (0, import_yaml.isScalar)(pair.key) ? String(pair.key.value) : String(pair.key);
    const line = lineCounter.linePos(pair.key?.range?.[0] ?? 0).line;
    if (!Object.hasOwn(ACCEPTS, key)) {
      warnings.push({ key, line, kind: "unknown-key" });
      continue;
    }
    const k = key;
    const value = pair.value?.toJSON?.() ?? null;
    if (ACCEPTS[k](value))
      config[k] = value;
    else
      warnings.push({ key, line, kind: "invalid-value", default: DEFAULT_CONFIG[k] });
  }
  for (const k of ["specsDir", "steeringDir"])
    if (outside(root, config[k]))
      return unreadable(`.steno/config.yaml: ${k} "${config[k]}" is outside the project root`);
  return { config, warnings };
}
function loadConfig(root) {
  const r = readConfig(root);
  if (r.unreadable)
    throw new StenoError("not-set-up", `steno is not set up here: ${r.unreadable}`, { file: ".steno/config.yaml", reason: r.unreadable });
  return r.config;
}
function saveConfig(root, cfg) {
  const p = configPath(root);
  mkdirSync(dirname(p), { recursive: true });
  const existing = existsSync2(p) ? readFileSync2(p, "utf8") : configTemplate();
  const doc = import_yaml.default.parseDocument(existing);
  for (const [k, v] of Object.entries(cfg))
    doc.set(k, v);
  writeFileSync(p, doc.toString());
}
function specsRoot(root, cfg = loadConfig(root)) {
  return resolve(root, cfg.specsDir);
}
function steeringRoot(root, cfg = loadConfig(root)) {
  return resolve(root, cfg.steeringDir);
}

// ../core/dist/state.js
var import_yaml2 = __toESM(require_dist(), 1);
import { existsSync as existsSync3, mkdirSync as mkdirSync2, readFileSync as readFileSync3, writeFileSync as writeFileSync2 } from "node:fs";
import { basename, join as join2 } from "node:path";
import { createHash } from "node:crypto";
var STATE_FILE = "spec.yaml";
function newState(name, opts = {}) {
  return {
    name,
    title: opts.title ?? name,
    kind: opts.kind ?? "feature",
    mode: opts.mode ?? "gated",
    phase: opts.phase ?? "requirements",
    created: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
    approvals: {}
  };
}
var FORMAT_VERSION = 1;
var quote = (v) => typeof v === "number" ? String(v) : JSON.stringify(v) ?? String(v);
var isMapping = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
var KINDS = ["feature", "bugfix"];
var MODES = ["gated", "quick"];
function parseState(text) {
  let raw;
  try {
    raw = import_yaml2.default.parse(text);
  } catch (e) {
    return { flag: "unreadable", reason: `spec.yaml is not valid YAML: ${e.message.split("\n")[0]}` };
  }
  if (!isMapping(raw))
    return { flag: "unreadable", reason: "spec.yaml is not a mapping" };
  if (Object.hasOwn(raw, "formatVersion") && raw.formatVersion !== FORMAT_VERSION) {
    const v = raw.formatVersion;
    return { flag: "unsupported", reason: typeof v === "number" && Number.isInteger(v) && v > FORMAT_VERSION ? `format version ${v} is newer than this steno understands; update steno` : `format version ${quote(v)} is not valid` };
  }
  const bad = (reason) => ({ flag: "unreadable", reason: `spec.yaml ${reason}` });
  const oneOf = (key, allowed) => {
    if (!Object.hasOwn(raw, key))
      return `is missing the required key ${key}`;
    const v = raw[key];
    return allowed.includes(v) ? void 0 : `has ${key} ${quote(v)}; expected ${allowed.join(", ")}`;
  };
  if (!Object.hasOwn(raw, "name"))
    return bad("is missing the required key name");
  if (typeof raw.name !== "string" || raw.name.trim() === "")
    return bad(`has name ${quote(raw.name)}; expected a non-empty string`);
  for (const [key, allowed] of [["kind", KINDS], ["mode", MODES], ["phase", PHASES]]) {
    const err = oneOf(key, allowed);
    if (err)
      return bad(err);
  }
  const approvals = {};
  if (isMapping(raw.approvals))
    for (const k of ["requirements", "design", "tasks"]) {
      const v = raw.approvals[k];
      if (v != null)
        approvals[k] = String(v);
    }
  const state = {
    name: raw.name,
    kind: raw.kind,
    mode: raw.mode,
    phase: raw.phase,
    created: raw.created == null ? "" : String(raw.created),
    approvals
  };
  if (typeof raw.title === "string")
    state.title = raw.title;
  if (Object.hasOwn(raw, "formatVersion"))
    state.formatVersion = FORMAT_VERSION;
  return { state };
}
function loadState(specDir2) {
  const p = join2(specDir2, STATE_FILE);
  const r = diskSource.read(p);
  if (!r)
    throw new Error(`not a steno spec (missing ${STATE_FILE}): ${specDir2}`);
  const spec = basename(specDir2);
  const read = "error" in r ? { flag: "unreadable", reason: `${STATE_FILE} ${r.error}` } : parseState(r.text);
  if ("flag" in read)
    throw new StenoError(read.flag, `${spec}: ${read.reason}`, { spec, file: p, reason: read.reason });
  return read.state;
}
function stateText(s) {
  return `# machine-owned by steno; edit phase/approvals only via the CLI
${import_yaml2.default.stringify(s)}`;
}
function saveState(specDir2, s) {
  writeFileSync2(join2(specDir2, STATE_FILE), stateText(s));
}
function sha(text) {
  return createHash("sha1").update(text).digest("hex").slice(0, 10);
}
function derivePhase(s, allTasksDone2) {
  if (s.mode === "quick")
    return allTasksDone2 ? "done" : "execute";
  if (!s.approvals.requirements)
    return "requirements";
  if (!s.approvals.design)
    return "design";
  if (!s.approvals.tasks)
    return "tasks";
  return allTasksDone2 ? "done" : "execute";
}
function approvalError(s, phase) {
  if (s.mode === "quick")
    return `${s.name} is a quick spec; it has no approval gates`;
  if (phase !== s.phase)
    return `${s.name} is in phase ${s.phase}; only ${s.phase} can be approved now (got ${phase})`;
  return void 0;
}
function syncDonePhase(s, allTasksDone2) {
  const to = s.phase === "execute" && allTasksDone2 ? "done" : s.phase === "done" && !allTasksDone2 ? "execute" : s.phase;
  if (to === s.phase)
    return false;
  s.phase = to;
  return true;
}
var seenPath = (root) => join2(root, ".steno", "cache", "seen.json");
function readSeenCache(root) {
  try {
    return JSON.parse(readFileSync3(seenPath(root), "utf8"));
  } catch {
    return {};
  }
}
function loadSeen(root, spec) {
  return readSeenCache(root)[spec] ?? {};
}
function saveSeen(root, spec, seen) {
  const dir = join2(root, ".steno", "cache");
  mkdirSync2(dir, { recursive: true });
  if (!existsSync3(join2(dir, ".gitignore")))
    writeFileSync2(join2(dir, ".gitignore"), "# local steno cache; never committed\n*\n");
  writeFileSync2(seenPath(root), JSON.stringify({ ...readSeenCache(root), [spec]: seen }, null, 2) + "\n");
}

// ../core/dist/spec.js
import { existsSync as existsSync4, readdirSync as readdirSync2, writeFileSync as writeFileSync3, mkdirSync as mkdirSync3 } from "node:fs";
import { basename as basename2, join as join3 } from "node:path";

// ../core/dist/parse/requirements.js
var STENO_HEAD = /^##\s+(R\d+)\s+(.*?)\s*$/;
var KIRO_HEAD = /^###\s+Requirement\s+(\d+)\s*(?:[:\-–]\s*(.*?))?\s*$/i;
var STORY = /^\*\*User Story:?\*\*:?\s*(.*)$/i;
var AC_HEAD = /^#{3,4}\s+Acceptance Criteria\s*$/i;
var CRIT = /^\s*(\d+)\.\s+(.*?)\s*$/;
var TITLE = /^#\s+(.*)$/;
var GLOSS = /^\s*[-*]\s+\*\*([^*]+)\*\*\s*:\s*(.*)$/;
function parseRequirements(raw) {
  const lines = raw.split(/\r?\n/);
  const doc = { title: "", glossary: [], requirements: [], raw };
  let cur;
  let inAC = false;
  let section = "other";
  const intro = [];
  const close = (i) => {
    if (cur) {
      cur.endLine = i;
      cur = void 0;
    }
  };
  lines.forEach((line, idx) => {
    const ln = idx + 1;
    if (!doc.title) {
      const t = TITLE.exec(line);
      if (t) {
        doc.title = t[1].trim();
        return;
      }
    }
    let m = STENO_HEAD.exec(line);
    if (!m) {
      const k = KIRO_HEAD.exec(line);
      if (k)
        m = [k[0], `R${k[1]}`, k[2] ?? ""];
    }
    if (m) {
      close(ln - 1);
      cur = { id: m[1], n: Number(m[1].slice(1)), title: (m[2] ?? "").trim(), criteria: [], line: ln, endLine: ln };
      doc.requirements.push(cur);
      inAC = false;
      return;
    }
    if (!cur) {
      if (/^##\s+Introduction\s*$/i.test(line)) {
        section = "intro";
        return;
      }
      if (/^##\s+Glossary\s*$/i.test(line)) {
        section = "glossary";
        return;
      }
      if (/^#{1,2}\s/.test(line)) {
        section = "other";
        return;
      }
      if (section === "intro")
        intro.push(line);
      if (section === "glossary") {
        const g = GLOSS.exec(line);
        if (g)
          doc.glossary.push({ term: g[1].trim(), definition: g[2].trim(), line: ln });
      }
      return;
    }
    if (/^#{1,2}\s/.test(line)) {
      close(ln - 1);
      return;
    }
    const s = STORY.exec(line.trim());
    if (s) {
      cur.story = s[1].trim();
      return;
    }
    if (AC_HEAD.test(line)) {
      inAC = true;
      return;
    }
    if (/^#{3,4}\s/.test(line)) {
      inAC = false;
      return;
    }
    if (inAC) {
      const c = CRIT.exec(line);
      if (c) {
        const n = Number(c[1]);
        const crit = { id: `${cur.id}.${n}`, n, text: c[2], line: ln };
        cur.criteria.push(crit);
      }
    }
  });
  close(lines.length);
  const introText = intro.join("\n").trim();
  if (introText)
    doc.intro = introText;
  return doc;
}
function findRequirement(doc, id) {
  return doc.requirements.find((r) => r.id === id);
}
function findCriterion(doc, id) {
  for (const r of doc.requirements) {
    const c = r.criteria.find((c2) => c2.id === id);
    if (c)
      return c;
  }
  return void 0;
}

// ../core/dist/parse/design.js
var HEAD = /^(#{1,4})\s+(.*?)(?:\s*\{#(D-[\w-]+)\})?\s*$/;
var SATISFIES = /(?:_|\*\*)(?:Satisfies|Validates):\s*(?:Requirements?\s*)?([^_*\n]*?)\s*(?:_|\*\*)/i;
function implicitDesignId(heading) {
  const slug = heading.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return `D-${slug || "section"}`;
}
function parseDesign(raw) {
  const lines = raw.split(/\r?\n/);
  const doc = { title: "", sections: [], raw };
  const open = [];
  const closeDeeper = (level, endLine) => {
    while (open.length && open[open.length - 1].level >= level) {
      const s = open.pop();
      s.endLine = endLine;
      s.body = lines.slice(s.line, s.endLine).join("\n").trim();
    }
  };
  lines.forEach((line, idx) => {
    const ln = idx + 1;
    const m = HEAD.exec(line);
    if (!m) {
      const sat = SATISFIES.exec(line);
      if (sat && open.length) {
        const target = open[open.length - 1];
        target.satisfies.push(...sat[1].split(",").map((s) => normReqId(s)).filter(Boolean));
      }
      return;
    }
    const level = m[1].length;
    if (level === 1) {
      doc.title ||= m[2].trim();
      return;
    }
    closeDeeper(level, ln - 1);
    const sec = {
      id: m[3] ?? implicitDesignId(m[2]),
      heading: m[2].trim(),
      level,
      satisfies: [],
      line: ln,
      endLine: ln,
      body: ""
    };
    doc.sections.push(sec);
    open.push(sec);
  });
  closeDeeper(0, lines.length);
  const seen = /* @__PURE__ */ new Map();
  for (const s of doc.sections) {
    const n = seen.get(s.id) ?? 0;
    if (n > 0)
      s.id = `${s.id}-${n + 1}`;
    seen.set(s.id.replace(/-\d+$/, ""), n + 1);
  }
  return doc;
}
function findSection(doc, id) {
  return doc.sections.find((s) => s.id === id);
}

// ../core/dist/parse/tasks.js
var TASK = /^(\s*)[-*]\s+\[([ xX])\](\*?)\s+(\d+(?:\.\d+)*)\.?\s+(.*?)\s*$/;
var FOOTER = /_(Requirements|Design):\s*([^_]*)_/gi;
var TITLE2 = /^#\s+(.*)$/;
var CHECKPOINT = /^(?:final\s+)?checkpoint\b/i;
function parseTasks(raw) {
  const lines = raw.split(/\r?\n/);
  const doc = { title: "", tasks: [], raw };
  const byId = /* @__PURE__ */ new Map();
  let last;
  lines.forEach((line, idx) => {
    const ln = idx + 1;
    if (!doc.title) {
      const t = TITLE2.exec(line);
      if (t) {
        doc.title = t[1].trim();
        return;
      }
    }
    const m = TASK.exec(line);
    if (m) {
      const num = m[4];
      const id = `T${num}`;
      const parentNum = num.includes(".") ? num.slice(0, num.lastIndexOf(".")) : void 0;
      const task = {
        id,
        num,
        title: m[5],
        done: m[2] !== " ",
        optional: m[3] === "*",
        checkpoint: CHECKPOINT.test(m[5]),
        requirements: [],
        design: [],
        line: ln,
        depth: num.split(".").length - 1,
        parent: parentNum ? `T${parentNum}` : void 0,
        children: []
      };
      doc.tasks.push(task);
      byId.set(id, task);
      if (task.parent)
        byId.get(task.parent)?.children.push(id);
      last = task;
      return;
    }
    if (!last)
      return;
    if (/^#{1,2}\s/.test(line)) {
      last = void 0;
      return;
    }
    let f;
    FOOTER.lastIndex = 0;
    while (f = FOOTER.exec(line)) {
      const refs = f[2].split(",").map((s) => s.trim()).filter(Boolean);
      if (f[1].toLowerCase() === "requirements")
        last.requirements.push(...refs.map(normReqId));
      else
        last.design.push(...refs);
    }
  });
  return doc;
}
function findTask(doc, id) {
  return doc.tasks.find((t) => t.id === id);
}
function isLeaf(t) {
  return t.children.length === 0;
}
function nextTask(doc, includeOptional = false) {
  return doc.tasks.find((t) => isLeaf(t) && !t.done && (includeOptional || !t.optional));
}
function allTasksDone(doc) {
  return !nextTask(doc);
}
function setTaskDone(doc, id, done = true) {
  const lines = doc.raw.split(/(?<=\n)/);
  const state = new Map(doc.tasks.map((t2) => [t2.id, t2.done]));
  const flip = (t2, d) => {
    lines[t2.line - 1] = lines[t2.line - 1].replace(/\[( |x|X)\]/, d ? "[x]" : "[ ]");
    state.set(t2.id, d);
  };
  const t = findTask(doc, id);
  if (!t)
    throw new Error(`unknown task ${id}`);
  flip(t, done);
  const down = (p2) => {
    for (const c of p2.children) {
      const ct = findTask(doc, c);
      if (ct) {
        flip(ct, done);
        down(ct);
      }
    }
  };
  down(t);
  let p = t.parent ? findTask(doc, t.parent) : void 0;
  while (p) {
    const all = p.children.every((c) => state.get(c));
    flip(p, done ? all : false);
    p = p.parent ? findTask(doc, p.parent) : void 0;
  }
  return lines.join("");
}

// ../core/dist/spec.js
var ARTIFACTS = ["brief.md", "requirements.md", "bugfix.md", "design.md", "tasks.md"];
function specDir(projectRoot, name) {
  return join3(specsRoot(projectRoot), name);
}
var SLUG = /^[a-z0-9][a-z0-9-]*$/;
function assertSlug(name) {
  if (!SLUG.test(name))
    throw new Error(`spec name must be a kebab-case slug, got "${name}"`);
}
function isSpecDir(dir, src = diskSource) {
  const names = src.list(dir);
  return names.includes(STATE_FILE) || ARTIFACTS.some((f) => names.includes(f));
}
function stateFromArtifacts(name, dir, src = diskSource) {
  const names = src.list(dir);
  const has = (f) => names.includes(f);
  const state = newState(name, { kind: has("bugfix.md") ? "bugfix" : "feature" });
  const today2 = state.created;
  if (has("requirements.md") || has("bugfix.md"))
    state.approvals.requirements = today2;
  if (has("design.md"))
    state.approvals.design = today2;
  if (has("tasks.md"))
    state.approvals.tasks = today2;
  const tasks = has("tasks.md") ? src.read(join3(dir, "tasks.md")) : void 0;
  const allDone = !!tasks && "text" in tasks && allTasksDone(parseCached(join3(dir, "tasks.md"), tasks.text, parseTasks));
  state.phase = has("tasks.md") ? allDone ? "done" : "execute" : has("design.md") ? "tasks" : state.approvals.requirements ? "design" : "requirements";
  return state;
}
var parsed = /* @__PURE__ */ new Map();
function parseCached(path2, text, parse) {
  const hit = parsed.get(path2);
  if (hit && hit.text === text)
    return hit.doc;
  const doc = parse(text);
  parsed.set(path2, { text, doc });
  return doc;
}
function livePhase(state, tasks) {
  return state.phase === "done" && tasks && !allTasksDone(tasks) ? { ...state, phase: "execute" } : state;
}
function buildSpec(dir, state, files) {
  const reqFile = requirementsFile(state);
  const reqRaw = files[reqFile];
  const tasks = files["tasks.md"] ? parseCached(join3(dir, "tasks.md"), files["tasks.md"], parseTasks) : void 0;
  return {
    root: dir,
    state: livePhase(state, tasks),
    files,
    requirements: reqRaw ? parseCached(join3(dir, reqFile), reqRaw, parseRequirements) : void 0,
    design: files["design.md"] ? parseCached(join3(dir, "design.md"), files["design.md"], parseDesign) : void 0,
    tasks,
    brief: files["brief.md"]
  };
}
function loadSpec(dir, src = diskSource) {
  if (!existsSync4(join3(dir, STATE_FILE)) && isSpecDir(dir, src))
    saveState(dir, stateFromArtifacts(basename2(dir), dir, src));
  const state = loadState(dir);
  const files = {};
  for (const f of ARTIFACTS) {
    const p = join3(dir, f);
    const r = src.read(p);
    if (!r)
      continue;
    if ("error" in r) {
      const reason = `${f} ${r.error}`;
      throw new StenoError("unreadable", `${basename2(dir)}: ${reason}`, { spec: basename2(dir), file: p, reason });
    }
    files[f] = r.text;
  }
  return buildSpec(dir, state, files);
}
function createSpec(projectRoot, name, opts = {}) {
  assertSlug(name);
  const dir = specDir(projectRoot, name);
  if (isSpecDir(dir))
    throw new Error(`spec already exists: ${dir}`);
  mkdirSync3(join3(dir, "reviews"), { recursive: true });
  const title = opts.title ?? name.replace(/-/g, " ");
  const state = newState(name, { title, kind: opts.bugfix ? "bugfix" : "feature", mode: opts.quick ? "quick" : "gated", phase: opts.brief ? "brief" : "requirements" });
  if (opts.quick)
    state.phase = "execute";
  const written = [];
  const put = (f, text) => {
    writeFileSync3(join3(dir, f), text);
    written.push(f);
  };
  const request = requestLine(opts.description);
  if (opts.brief)
    put("brief.md", withRequest(briefTemplate(title), request));
  else
    put(opts.bugfix ? "bugfix.md" : "requirements.md", withRequest(opts.bugfix ? bugfixTemplate(title) : requirementsTemplate(title), request));
  if (opts.quick) {
    put("design.md", designTemplate(title));
    put("tasks.md", tasksTemplate(title));
  }
  saveState(dir, state);
  return { dir, state, written };
}
function requirementsFile(state) {
  return state.kind === "bugfix" ? "bugfix.md" : "requirements.md";
}
function artifactFor(state) {
  switch (state.phase) {
    case "brief":
      return "brief.md";
    case "requirements":
      return requirementsFile(state);
    case "design":
      return "design.md";
    case "tasks":
      return "tasks.md";
    default:
      return void 0;
  }
}
function scaffoldCurrent(spec) {
  const title = spec.state.title ?? spec.state.name;
  const f = artifactFor(spec.state);
  if (!f || spec.files[f])
    return void 0;
  const tpl = { "brief.md": briefTemplate, "requirements.md": requirementsTemplate, "bugfix.md": bugfixTemplate, "design.md": designTemplate, "tasks.md": tasksTemplate };
  writeFileSync3(join3(spec.root, f), tpl[f](title));
  return f;
}

// ../core/dist/steering.js
var import_picomatch = __toESM(require_picomatch2(), 1);
import { join as join4 } from "node:path";
var FM = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n)?/;
function parseSteering(file, raw) {
  const m = FM.exec(raw);
  let inclusion = "always", pattern;
  if (m) {
    const inc = /inclusion:\s*(\w+)/.exec(m[1])?.[1];
    if (inc === "fileMatch" || inc === "manual" || inc === "always")
      inclusion = inc;
    pattern = /fileMatchPattern:\s*['"]?([^'"\n]+)/.exec(m[1])?.[1]?.trim();
  }
  return { file, inclusion, pattern, body: raw.replace(FM, "").replace(/\r\n/g, "\n").trim() };
}
function loadSteeringEntries(dir, src = diskSource) {
  return src.list(dir).filter((f) => f.endsWith(".md")).flatMap((f) => {
    const path2 = join4(dir, f);
    const r = src.read(path2);
    if (!r)
      return [];
    return ["error" in r ? { file: path2, unreadable: `${f} ${r.error}` } : { file: path2, steering: parseSteering(f, r.text), text: r.text }];
  });
}
function loadSteering(projectRoot, src = diskSource) {
  return loadSteeringEntries(steeringRoot(projectRoot), src).flatMap((e) => e.steering ? [e.steering] : []);
}
function matchingSteering(all, files) {
  return all.filter((s) => {
    if (s.inclusion === "always")
      return true;
    if (s.inclusion === "manual" || !s.pattern)
      return false;
    const isMatch = (0, import_picomatch.default)(splitPattern(s.pattern));
    return files.some((f) => isMatch(f));
  });
}
function splitPattern(pattern) {
  const out2 = [];
  let depth = 0, cur = "";
  for (const ch of pattern) {
    if (ch === "{")
      depth++;
    else if (ch === "}")
      depth--;
    if (ch === "," && depth === 0) {
      out2.push(cur);
      cur = "";
    } else
      cur += ch;
  }
  out2.push(cur);
  return out2.map((p) => p.trim()).filter(Boolean);
}

// ../core/dist/project.js
import { statSync } from "node:fs";
import { join as join5, resolve as resolve2 } from "node:path";
var isDir = (p) => {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
};
function loadEntry(dir, name, src) {
  const problems = [];
  let flag;
  let state;
  const statePath = join5(dir, STATE_FILE);
  const st = src.read(statePath);
  if (st && "error" in st) {
    flag = "unreadable";
    problems.push({ file: statePath, reason: `${STATE_FILE} ${st.error}` });
  } else if (st) {
    const r = parseState(st.text);
    if ("flag" in r) {
      flag = r.flag;
      problems.push({ file: statePath, reason: r.reason });
    } else
      state = r.state;
  }
  const files = {};
  for (const f of ARTIFACTS) {
    const p = join5(dir, f);
    const r = src.read(p);
    if (!r)
      continue;
    if ("error" in r) {
      flag ??= "unreadable";
      problems.push({ file: p, reason: `${f} ${r.error}` });
    } else
      files[f] = r.text;
  }
  if (flag)
    return { name, flag, files: problems };
  if (state)
    return { name, spec: buildSpec(dir, state, files), derived: false };
  return { name, spec: buildSpec(dir, stateFromArtifacts(name, dir, src), files), derived: true };
}
function loadProject(root, src = diskSource) {
  root = resolve2(root);
  const cfg = readConfig(root, diskSource);
  const base = { root, config: cfg.config, configWarnings: cfg.warnings, specs: [], steering: [] };
  if (!isDir(join5(root, ".steno")))
    return { ...base, setUp: false, reason: `no .steno folder in ${root}; run steno init` };
  if (cfg.unreadable)
    return { ...base, setUp: false, reason: cfg.unreadable };
  const specsDir = resolve2(root, cfg.config.specsDir);
  const specs = src.list(specsDir).filter((n) => isSpecDir(join5(specsDir, n), src)).map((n) => loadEntry(join5(specsDir, n), n, src));
  const steering = loadSteeringEntries(resolve2(root, cfg.config.steeringDir), src);
  return { ...base, setUp: true, specs, steering };
}
function persistDerived(snap, name) {
  const entry = snap.specs.find((e) => e.name === name);
  if (!entry || !("spec" in entry) || !entry.derived)
    return;
  const today2 = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const approvals = Object.fromEntries(Object.keys(entry.spec.state.approvals).map((k) => [k, today2]));
  const state = { ...entry.spec.state, created: today2, approvals };
  saveState(entry.spec.root, state);
  entry.spec = { ...entry.spec, state };
  entry.derived = false;
}

// ../core/dist/steer.js
var import_picomatch2 = __toESM(require_picomatch2(), 1);
import { existsSync as existsSync5, readdirSync as readdirSync3, readFileSync as readFileSync4, statSync as statSync2, writeFileSync as writeFileSync4, mkdirSync as mkdirSync4 } from "node:fs";
import { join as join6, relative as relative2, basename as basename3 } from "node:path";
var SKIP_DIRS = /* @__PURE__ */ new Set(["node_modules", ".git", "dist", "build", "out", "coverage", "vendor", "target", ".next", ".nuxt", ".svelte-kit", ".turbo", ".cache", ".venv", "venv", "__pycache__", ".idea", ".vscode", ".gradle", "Pods", "DerivedData", ".dart_tool", "tmp"]);
var MAX_DEPTH = 7;
var MAX_FILES = 6e3;
var MANIFESTS = ["package.json", "requirements.txt", "pyproject.toml", "Pipfile", "go.mod", "Cargo.toml", "Gemfile", "composer.json", "pubspec.yaml", "build.gradle", "build.gradle.kts", "pom.xml", "mix.exs", "Package.swift"];
function probe(root) {
  const files = [], dirs = [];
  const walk = (dir, depth) => {
    if (depth > MAX_DEPTH || files.length >= MAX_FILES)
      return;
    let entries = [];
    try {
      entries = readdirSync3(dir);
    } catch {
      return;
    }
    for (const name of entries.sort()) {
      if (files.length >= MAX_FILES)
        return;
      const abs = join6(dir, name);
      let st;
      try {
        st = statSync2(abs);
      } catch {
        continue;
      }
      const rel2 = relative2(root, abs).split("\\").join("/");
      if (st.isDirectory()) {
        if (SKIP_DIRS.has(name) || name.startsWith(".") && ![".github", ".gitlab", ".circleci"].includes(name))
          continue;
        dirs.push(rel2);
        walk(abs, depth + 1);
      } else
        files.push(rel2);
    }
  };
  walk(root, 0);
  const deps = /* @__PURE__ */ new Set();
  const manifests = [];
  const scripts = [];
  for (const f of files) {
    const base = basename3(f);
    if (!MANIFESTS.includes(base) || f.split("/").length > 3)
      continue;
    manifests.push(f);
    let text = "";
    try {
      text = readFileSync4(join6(root, f), "utf8");
    } catch {
      continue;
    }
    for (const d of depsOf(base, text))
      deps.add(d.toLowerCase());
    if (base === "package.json") {
      try {
        scripts.push(...Object.values(JSON.parse(text).scripts ?? {}).filter((v) => typeof v === "string"));
      } catch {
      }
    }
  }
  return { root, files, dirs, deps, manifests, scripts };
}
function depsOf(manifest, text) {
  if (manifest === "package.json") {
    try {
      const j = JSON.parse(text);
      return [...Object.keys(j.dependencies ?? {}), ...Object.keys(j.devDependencies ?? {}), ...Object.keys(j.peerDependencies ?? {})];
    } catch {
      return [];
    }
  }
  if (manifest === "composer.json") {
    try {
      const j = JSON.parse(text);
      return [...Object.keys(j.require ?? {}), ...Object.keys(j["require-dev"] ?? {})];
    } catch {
      return [];
    }
  }
  if (manifest === "requirements.txt" || manifest === "Pipfile")
    return text.split("\n").map((l) => /^\s*([A-Za-z0-9_.-]+)/.exec(l)?.[1] ?? "").filter(Boolean);
  if (manifest === "pyproject.toml")
    return [...text.matchAll(/^\s*"?([A-Za-z0-9_.-]+)"?\s*(?:[>=<~!]=|\s*=\s*["{]|,|"$|$)/gm)].map((m) => m[1]).filter((d) => !["name", "version", "python", "description", "readme", "requires", "build-backend", "authors", "license"].includes(d));
  if (manifest === "go.mod")
    return [...text.matchAll(/^\s*([\w.-]+(?:\/[\w.-]+)+)\s+v/gm)].map((m) => m[1]);
  if (manifest === "Cargo.toml")
    return [...text.matchAll(/^([A-Za-z0-9_-]+)\s*=/gm)].map((m) => m[1]);
  if (manifest === "Gemfile")
    return [...text.matchAll(/^\s*gem\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]);
  if (manifest === "pubspec.yaml")
    return [...text.matchAll(/^  ([a-z0-9_]+):/gm)].map((m) => m[1]);
  if (manifest.startsWith("build.gradle"))
    return [...text.matchAll(/['"]([a-zA-Z0-9_.-]+:[a-zA-Z0-9_.-]+)(?::[^'"]+)?['"]/g)].map((m) => m[1]);
  if (manifest === "pom.xml")
    return [...text.matchAll(/<artifactId>([^<]+)<\/artifactId>/g)].map((m) => m[1]);
  if (manifest === "mix.exs")
    return [...text.matchAll(/\{:([a-z_]+),/g)].map((m) => m[1]);
  if (manifest === "Package.swift")
    return [...text.matchAll(/url:\s*"[^"]*\/([^/"]+?)(?:\.git)?"/g)].map((m) => m[1]);
  return [];
}
var LANG_EXT = { ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript", mjs: "javascript", py: "python", go: "go", rs: "rust", rb: "ruby", php: "php", dart: "dart", kt: "kotlin", kts: "kotlin", java: "java", swift: "swift", ex: "elixir", exs: "elixir", cs: "csharp", sql: "sql", vue: "vue", svelte: "svelte" };
var FRAMEWORKS = [
  ["next", "next"],
  ["nuxt", "nuxt"],
  ["@remix-run/react", "remix"],
  ["@sveltejs/kit", "sveltekit"],
  ["astro", "astro"],
  ["@angular/core", "angular"],
  ["react", "react"],
  ["vue", "vue"],
  ["svelte", "svelte"],
  ["solid-js", "solid"],
  ["vite", "vite"],
  ["expo", "expo"],
  ["react-native", "react-native"],
  ["express", "express"],
  ["fastify", "fastify"],
  ["hono", "hono"],
  ["koa", "koa"],
  ["@nestjs/core", "nestjs"],
  ["@trpc/server", "trpc"],
  ["django", "django"],
  ["fastapi", "fastapi"],
  ["flask", "flask"],
  ["rails", "rails"],
  ["laravel/framework", "laravel"],
  ["flutter", "flutter"],
  ["github.com/gin-gonic/gin", "gin"],
  ["github.com/labstack/echo/v4", "echo"],
  ["github.com/gofiber/fiber/v2", "fiber"],
  ["actix-web", "actix"],
  ["axum", "axum"],
  ["phoenix", "phoenix"],
  ["org.springframework.boot:spring-boot-starter", "spring-boot"],
  ["androidx.compose.ui:ui", "jetpack-compose"],
  ["@prisma/client", "prisma"],
  ["prisma", "prisma"],
  ["drizzle-orm", "drizzle"],
  ["typeorm", "typeorm"],
  ["sequelize", "sequelize"],
  ["mongoose", "mongoose"],
  ["knex", "knex"],
  ["kysely", "kysely"],
  ["tailwindcss", "tailwind"],
  ["@mui/material", "mui"],
  ["@chakra-ui/react", "chakra"],
  ["next-auth", "next-auth"],
  ["@auth/core", "auth.js"],
  ["lucia", "lucia"],
  ["better-auth", "better-auth"],
  ["@clerk/nextjs", "clerk"],
  ["passport", "passport"],
  ["next-intl", "next-intl"],
  ["i18next", "i18next"],
  ["react-intl", "react-intl"],
  ["vue-i18n", "vue-i18n"]
];
var LOCKS = [["pnpm-lock.yaml", "pnpm"], ["yarn.lock", "yarn"], ["bun.lockb", "bun"], ["bun.lock", "bun"], ["package-lock.json", "npm"], ["uv.lock", "uv"], ["poetry.lock", "poetry"], ["Pipfile.lock", "pipenv"], ["requirements.txt", "pip"], ["go.sum", "go modules"], ["Cargo.lock", "cargo"], ["Gemfile.lock", "bundler"], ["composer.lock", "composer"], ["pubspec.lock", "pub"], ["gradlew", "gradle"], ["pom.xml", "maven"], ["mix.lock", "mix"]];
var BUILTIN_RUNNERS = [[/\bnode\b[^&|;]*\s--test\b/, "node:test"], [/\bbun\s+test\b/, "bun test"], [/\bdeno\s+test\b/, "deno test"]];
var RUNNERS = [["vitest", "vitest"], ["jest", "jest"], ["mocha", "mocha"], ["@playwright/test", "playwright"], ["cypress", "cypress"], ["pytest", "pytest"], ["rspec", "rspec"], ["phpunit/phpunit", "phpunit"], ["flutter_test", "flutter test"], ["junit:junit", "junit"], ["org.junit.jupiter:junit-jupiter", "junit5"]];
function profileOf(p) {
  const ext = {};
  for (const f of p.files) {
    const e = f.split(".").pop() ?? "";
    const l = LANG_EXT[e];
    if (l)
      ext[l] = (ext[l] ?? 0) + 1;
  }
  if (p.files.some((f) => /^go\.mod$/.test(f)))
    ext.go = (ext.go ?? 0) + 1;
  const languages = Object.entries(ext).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([l]) => l);
  const frameworks = [...new Set(FRAMEWORKS.filter(([dep]) => p.deps.has(dep.toLowerCase())).map(([, name]) => name))];
  const has = (f) => p.files.includes(f);
  const packageManager = LOCKS.find(([f]) => has(f))?.[1];
  const testRunner = RUNNERS.find(([dep]) => p.deps.has(dep.toLowerCase()))?.[1] ?? BUILTIN_RUNNERS.find(([re]) => (p.scripts ?? []).some((c) => re.test(c)))?.[1] ?? (p.files.some((f) => /_test\.go$/.test(f)) ? "go test" : void 0);
  const monorepo = has("pnpm-workspace.yaml") || has("turbo.json") || has("nx.json") || has("lerna.json") || p.dirs.includes("packages") || p.dirs.includes("apps");
  const counts = {};
  for (const f of p.files) {
    const top = f.includes("/") ? f.slice(0, f.indexOf("/")) + "/" : "(root)";
    counts[top] = (counts[top] ?? 0) + 1;
  }
  const topLevel = Object.entries(counts).map(([dir, files]) => ({ dir, files })).sort((a, b) => b.files - a.files);
  return { languages, frameworks, packageManager, testRunner, monorepo, topLevel, manifests: p.manifests };
}
var DETECTORS = [
  { file: "product.md", inclusion: "always", core: (p) => p.files.filter((f) => /^(readme\.md|docs\/[^/]+\.md|package\.json|pyproject\.toml)$/i.test(f)).slice(0, 6) },
  { file: "tech.md", inclusion: "always", core: (p) => [...p.manifests, ...p.files.filter((f) => /^(tsconfig\.json|\.nvmrc|\.tool-versions|Makefile|justfile|Taskfile\.ya?ml|\.github\/workflows\/[^/]+)$/.test(f))].slice(0, 8) },
  { file: "structure.md", inclusion: "always", core: (p) => p.dirs.filter((d) => d.split("/").length <= 2).slice(0, 25) },
  {
    file: "database.md",
    inclusion: "fileMatch",
    deps: ["prisma", "@prisma/client", "drizzle-orm", "knex", "sequelize", "typeorm", "mongoose", "@mikro-orm/core", "kysely", "pg", "mysql2", "better-sqlite3", "sqlalchemy", "alembic", "django", "peewee", "tortoise-orm", "gorm.io/gorm", "entgo.io/ent", "github.com/jmoiron/sqlx", "sqlx", "diesel", "sea-orm", "activerecord", "pg", "mysql", "doctrine/orm", "illuminate/database", "drift", "floor", "isar", "hive", "sqflite", "realm", "androidx.room:room-runtime", "ecto", "ecto_sql", "@supabase/supabase-js", "firebase-admin", "convex"],
    dirs: ["prisma", "drizzle", "migrations", "migrate", "db", "database", "alembic", "models", "entities", "schema", "supabase"],
    files: ["**/schema.prisma", "**/*.sql", "**/drizzle.config.*", "**/knexfile.*", "**/alembic.ini", "**/*.dbml"]
  },
  {
    file: "api.md",
    inclusion: "fileMatch",
    deps: ["express", "fastify", "hono", "koa", "@nestjs/core", "@trpc/server", "graphql", "@apollo/server", "fastapi", "flask", "djangorestframework", "github.com/gin-gonic/gin", "github.com/labstack/echo/v4", "github.com/gofiber/fiber/v2", "actix-web", "axum", "grpc", "@grpc/grpc-js"],
    dirs: ["api", "routes", "controllers", "handlers", "endpoints", "resolvers", "server/api", "app/api", "pages/api", "src/api"],
    files: ["**/openapi.{yaml,yml,json}", "**/swagger.{yaml,yml,json}", "**/*.graphql", "**/*.gql", "**/*.proto"]
  },
  {
    file: "auth.md",
    inclusion: "fileMatch",
    deps: ["next-auth", "@auth/core", "lucia", "better-auth", "@clerk/nextjs", "@clerk/clerk-react", "passport", "jsonwebtoken", "jose", "@supabase/auth-helpers-nextjs", "@supabase/ssr", "firebase", "django-allauth", "devise", "org.springframework.boot:spring-boot-starter-security", "firebase_auth", "guardian"],
    dirs: ["auth", "authentication", "(auth)", "sessions"],
    files: ["**/auth.config.*", "**/lib/auth.{ts,js}", "**/auth/[[]...nextauth[]]/**"]
  },
  {
    file: "i18n.md",
    inclusion: "fileMatch",
    deps: ["next-intl", "i18next", "react-i18next", "react-intl", "vue-i18n", "@lingui/core", "intl", "flutter_localizations", "django-modeltranslation", "rails-i18n", "gettext"],
    dirs: ["locales", "locale", "messages", "i18n", "lang", "translations", "l10n"],
    files: ["**/*.arb", "**/i18n.config.*", "**/*.po"]
  },
  {
    file: "ui.md",
    inclusion: "fileMatch",
    deps: ["tailwindcss", "@mui/material", "@chakra-ui/react", "styled-components", "@emotion/react", "@radix-ui/react-dialog", "shadcn", "vuetify", "primevue", "@mantine/core", "antd"],
    dirs: ["components", "ui", "design-system", "styles", "theme", "widgets", "presentation"],
    files: ["**/tailwind.config.*", "**/components.json", "**/*.css", "**/*.scss"],
    extraPattern: ["**/*.{tsx,jsx,vue,svelte}"]
  },
  {
    file: "testing.md",
    inclusion: "fileMatch",
    deps: ["vitest", "jest", "mocha", "@playwright/test", "cypress", "@testing-library/react", "pytest", "rspec", "phpunit/phpunit", "flutter_test", "junit:junit", "org.junit.jupiter:junit-jupiter", "github.com/stretchr/testify"],
    dirs: ["test", "tests", "__tests__", "e2e", "spec", "cypress", "playwright", "fixtures", "testutil"],
    files: ["**/vitest.config.*", "**/jest.config.*", "**/playwright.config.*", "**/pytest.ini", "**/conftest.py", "**/.rspec"],
    extraPattern: ["**/*.{test,spec}.*", "**/*_test.go", "**/test_*.py"]
  },
  {
    file: "infra.md",
    inclusion: "fileMatch",
    dirs: ["terraform", "infra", "infrastructure", "deploy", "k8s", "kubernetes", "helm", "cdk", "pulumi", "ansible", "docker"],
    files: ["**/Chart.yaml", "**/Dockerfile*", "**/docker-compose*.{yml,yaml}", "**/compose.{yml,yaml}", "**/*.tf", "**/cdk.json", "**/serverless.{yml,yaml}", "**/fly.toml", "**/vercel.json", "**/render.yaml", "**/Procfile", "**/netlify.toml"]
  },
  {
    file: "ci.md",
    inclusion: "fileMatch",
    dirs: [".github/workflows", ".circleci", ".gitlab"],
    files: ["**/.gitlab-ci.yml", "**/Jenkinsfile", "**/bitbucket-pipelines.yml", "**/.github/workflows/*", "**/azure-pipelines.yml", "**/.pre-commit-config.yaml"]
  },
  {
    file: "messaging.md",
    inclusion: "fileMatch",
    deps: ["bullmq", "bull", "kafkajs", "amqplib", "@aws-sdk/client-sqs", "celery", "sidekiq", "github.com/segmentio/kafka-go", "github.com/nats-io/nats.go", "rdkafka", "oban", "broadway"],
    dirs: ["jobs", "workers", "queues", "consumers", "subscribers"]
  },
  {
    file: "domain.md",
    inclusion: "fileMatch",
    dirs: ["domain", "usecases", "use_cases", "use-cases"]
  }
];
var STEERING_TOPICS = DETECTORS.map((d) => d.file);
function globAny(files, globs) {
  const m = (0, import_picomatch2.default)(globs, { dot: true });
  return files.filter((f) => m(f));
}
function escapeGlob(path2) {
  return path2.replace(/[()[\]{}!+@?*]/g, (ch) => `[${ch}]`);
}
function dirHits(p, names) {
  return p.dirs.filter((d) => {
    const base = d.split("/").pop();
    return names.some((n) => n.includes("/") ? d === n || d.endsWith("/" + n) : base === n) && d.split("/").length <= 3;
  });
}
function suggest(p, prof = profileOf(p)) {
  const existing = new Set(loadSteering(p.root).map((s) => s.file));
  const out2 = [];
  for (const d of DETECTORS) {
    if (d.core) {
      out2.push({ file: d.file, inclusion: "always", strength: "core", fileCount: 0, reason: "core (every project)", read: d.core(p, prof), exists: existing.has(d.file) });
      continue;
    }
    const deps = (d.deps ?? []).filter((x) => p.deps.has(x.toLowerCase()));
    const allDirs = dirHits(p, d.dirs ?? []);
    const dirs = allDirs.filter((x) => !allDirs.some((y) => y !== x && x.startsWith(y + "/")));
    const files = d.files ? globAny(p.files, d.files) : [];
    if (!deps.length && !dirs.length && !files.length)
      continue;
    const extras = (d.extraPattern ?? []).filter((g) => globAny(p.files, [g]).length);
    const pattern = [.../* @__PURE__ */ new Set([...dirs.map((x) => `${escapeGlob(x)}/**`), ...dirs.length ? [] : files.map((f) => f.includes("/") ? escapeGlob(f.slice(0, f.lastIndexOf("/"))) + "/**" : escapeGlob(f)), ...extras])].slice(0, 6).join(",");
    const reason = [deps.length ? `deps: ${deps.slice(0, 3).join(", ")}` : "", dirs.length ? `dirs: ${dirs.slice(0, 3).join(", ")}` : "", files.length && !dirs.length ? `files: ${files.slice(0, 2).join(", ")}` : ""].filter(Boolean).join("; ");
    const read = [.../* @__PURE__ */ new Set([...files, ...dirs.map((x) => x + "/")])].slice(0, 6);
    const behind = new Set(files);
    for (const dir of dirs)
      for (const f of p.files)
        if (f.startsWith(dir + "/"))
          behind.add(f);
    const fileCount = behind.size;
    const strength = deps.length || fileCount >= 3 ? "strong" : "weak";
    out2.push({ file: d.file, inclusion: d.inclusion, strength, fileCount, pattern: pattern || void 0, reason: strength === "weak" ? `${reason} (weak: ${fileCount} file${fileCount === 1 ? "" : "s"})` : reason, read, exists: existing.has(d.file) });
  }
  return out2;
}
function sourceFiles(p) {
  return p.files.filter((f) => !/\.(md|txt|ya?ml|json|toml|lock|ini|cfg|env|example)$/i.test(f) && !/^(\.agents|\.claude|\.cursor|\.github|\.gemini|\.kiro|\.steno|docs)\//.test(f) && !/^(AGENTS|CLAUDE|README|LICENSE)/i.test(f));
}
function isGreenfield(p) {
  return p.manifests.length === 0 && sourceFiles(p).length < 3;
}
var GREENFIELD_MSG = "greenfield: no manifest and no source yet. Steering records facts about existing code, so there is nothing to record. Start with a brief (steno-brainstorm) or a spec (steno-spec); run `steno steer scan` again once the first tasks or a manifest exist.";
function scan(root) {
  const p = probe(root);
  const profile = profileOf(p);
  return { profile, suggestions: suggest(p, profile), scanned: { files: p.files.length, dirs: p.dirs.length }, greenfield: isGreenfield(p), sourceFiles: sourceFiles(p).length };
}
var CORE_TEMPLATES = {
  "product.md": `# Product \u2014 <name>

**<name>** is <one sentence: what kind of thing it is (web app, CLI, API, mobile PWA), where it runs or its URL, and what it lets whom do>.

## Core problem
<two or three sentences: the situation without it, and what it changes. Written for someone who has never seen the app.>

## Key features
- **<Feature>** \u2014 <what it does, with the specifics that matter: limits, formats, code lengths, supported types>
- **<Feature>** \u2014 <\u2026>
- **<Feature>** \u2014 <\u2026>
<5\u201310 bullets, one per user-visible capability. Every feature a spec might touch gets a line.>

## Audience
<who uses it, primary and secondary; locales and the default locale; platforms>

## Domain model and rules
<the concepts and invariants everything else obeys, in plain words with the real term names: e.g. "Strict double-entry: every transaction satisfies \u03A3Debits = \u03A3Credits; users see Income / Expense / Transfer, never debit/credit", base vs account currency, tenancy model. Several short paragraphs or bullets.>

## Out of scope
<what it deliberately does not do, so specs do not drift into it>
`,
  "tech.md": `# Tech stack

## <Layer, e.g. Core framework>
- **<Library> <version>** \u2014 <what it is used for; the one or two features of it relied on>
- **<Library> <version>** \u2014 <\u2026>
<one \`## Layer\` section per concern: framework, language, database and auth, styling and UI, state and data, testing, build and deploy. Versions from the manifest, not from memory. 3\u20136 bullets each.>

## Commands
\`\`\`bash
<script>   # <what it does, when to run it>
<script>   # <\u2026>
\`\`\`
<every script in the manifest plus the db / infra commands a task might need; one comment each>

## Key config files
- \`<path>\` \u2014 <what it configures>

## Conventions
- <rule the code actually follows: strict TS, no \`any\`, validation lib on every mutation, error shape, lint setup>

## Do not
- <the alternatives a newcomer would reach for and must not: wrong ORM, bypassing auth layer, hardcoded strings>
`,
  "structure.md": `# Project structure

## Top-level layout
\`\`\`
<dir>/
  <sub>/      # <responsibility, one phrase>
  <sub>/      # <\u2026>
<file>        # <\u2026>
\`\`\`
<every top-level folder and the important files, two levels deep, each with a comment>

## \`<main source dir>/<area>/\` \u2014 <role>
<for each major area: what lives there, what it may depend on, its internal layout as a short tree or a table of subfolder \u2192 responsibility. Repeat the section per area (domain, features, app, components, lib, \u2026).>

| Subdirectory | Responsibility |
|---|---|
| \`<sub>/\` | <\u2026> |

## Where new code goes
- <kind of change> \u2192 \`<path pattern>\` (<and the test location>)

## Key conventions
- **<Rule>:** <the concrete form, naming the helper, component or file to use and what never to do instead>
<6\u201310 bullets: data fetching vs mutation paths, session/auth helper, shared inputs and formatters, i18n, db changes. These are the rules a reviewer would cite.>
`
};
var TOPIC_HEADINGS = {
  "database.md": ["Engine and client", "Tables", "Schema conventions", "Migrations", "Invariants", "Query patterns", "Seeds and test data"],
  "api.md": ["Style", "Request and response shape", "Errors", "Auth and middleware", "Versioning", "Adding an endpoint"],
  "auth.md": ["Mechanism", "Session and token rules", "Roles and permissions", "Protected routes", "Do not"],
  "i18n.md": ["Locales", "Where strings live", "Adding a string", "Formatting (dates, numbers, currency)", "Do not"],
  "ui.md": ["Component library", "Layout and spacing", "Theming and tokens", "State and forms", "Accessibility", "Do not"],
  "testing.md": ["Runner and commands", "Where tests live", "Unit vs integration vs e2e", "Fixtures and factories", "What every change must cover"],
  "infra.md": ["Environments", "How it is deployed", "Config and secrets", "Local run", "Do not"],
  "ci.md": ["Pipelines", "What must pass", "How to add a check", "Caching and secrets"],
  "messaging.md": ["Broker and client", "Topics, queues and jobs", "Message shape", "Retries and idempotency", "Adding a consumer"],
  "domain.md": ["Bounded contexts", "Core entities", "Invariants", "Use-case shape", "Boundaries"]
};
var GENERIC = ["Purpose", "Rules", "Patterns to reuse", "Do not"];
var CORE_FILES = Object.keys(CORE_TEMPLATES);
function steeringTemplate(file, inclusion, pattern) {
  const name = file.replace(/\.md$/, "");
  const fm = inclusion === "always" ? "" : `---
inclusion: ${inclusion}${pattern ? `
fileMatchPattern: "${pattern}"` : ""}
---
`;
  if (CORE_TEMPLATES[file])
    return fm + CORE_TEMPLATES[file];
  const heads = TOPIC_HEADINGS[file] ?? GENERIC;
  const HINT = { Tables: "<paste the output of `steno steer schema` in a ```schema fenced block: one line per table with foreign keys, the enums, and the parent \u2190 children summary. Drop columns nobody queries; keep every arrow. Add one line per relation that needs words (ownership, cascade, polymorphism).>" };
  return `${fm}# ${name[0].toUpperCase() + name.slice(1)}

<two or three sentences: what this area is, which files it covers, and the one thing an agent most often gets wrong here. Only what product/tech/structure do not already say.>

${heads.map((h) => `## ${h}
${HINT[h] ?? "- <fact: the real path, command, helper or name, and the rule around it>\n- <\u2026>"}`).join("\n\n")}
`;
}
function templateFor(root, file) {
  if (!file.endsWith(".md"))
    file += ".md";
  const s = suggest(probe(root)).find((s2) => s2.file === file);
  return steeringTemplate(file, s?.inclusion ?? (CORE_TEMPLATES[file] ? "always" : "fileMatch"), s?.pattern);
}
function writeSteering(root, file, opts = {}) {
  if (!file.endsWith(".md"))
    file += ".md";
  if (!/^[a-z0-9][a-z0-9-]*\.md$/.test(file))
    throw new Error(`steering file name must be kebab-case: ${file}`);
  const dir = steeringRoot(root);
  mkdirSync4(dir, { recursive: true });
  const path2 = join6(dir, file);
  if (existsSync5(path2) && !opts.force)
    throw new Error(`${relative2(root, path2)} exists (use --force to overwrite)`);
  let inclusion = opts.inclusion, pattern = opts.pattern;
  if (!inclusion || inclusion === "fileMatch" && !pattern) {
    const s = suggest(probe(root)).find((s2) => s2.file === file);
    inclusion ??= s?.inclusion ?? (pattern ? "fileMatch" : "always");
    if (inclusion === "fileMatch")
      pattern ??= s?.pattern;
  }
  if (inclusion === "fileMatch" && !pattern)
    throw new Error(`fileMatch needs a pattern: --match "src/x/**"`);
  writeFileSync4(path2, steeringTemplate(file, inclusion, pattern));
  return { path: path2, inclusion, pattern };
}
var STEERING_MAX_BYTES = 4096;
var MAX_BYTES_BY_FILE = { "database.md": 6144 };
var STEERING_THIN_BYTES = { "product.md": 1200, "tech.md": 1200, "structure.md": 2e3 };
var THIN_TOPIC_BYTES = 350;
function listSteering(root, p = probe(root)) {
  const cfg = loadConfig(root);
  const rows = loadSteering(root).map((s) => {
    const bytes = Buffer.byteLength(s.body, "utf8");
    const matches = s.inclusion === "fileMatch" && s.pattern ? globAny(p.files, splitPattern(s.pattern)).length : void 0;
    return { file: s.file, inclusion: s.inclusion, pattern: s.pattern, tokens: estimateTokens(s.body), bytes, matches };
  });
  const alwaysTokens = rows.filter((r) => r.inclusion === "always").reduce((n, r) => n + r.tokens, 0);
  return { rows, alwaysTokens, budget: cfg.steeringBudget };
}
function lintSteeringFiles(files, budget, matches) {
  const issues = [];
  let alwaysTokens = 0;
  for (const { file: name, text: raw } of files) {
    const s = parseSteering(name, raw);
    const file = `steering/${name}`;
    const bytes = Buffer.byteLength(s.body, "utf8");
    if (s.inclusion === "always")
      alwaysTokens += estimateTokens(s.body);
    const fmMatch = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
    const fm = fmMatch?.[1];
    if (fm) {
      const inc = /inclusion:\s*(\S+)/.exec(fm)?.[1];
      if (inc && !["always", "fileMatch", "manual"].includes(inc))
        issues.push({ level: "error", rule: "steering/inclusion", file, msg: `unknown inclusion "${inc}" (always | fileMatch | manual)` });
      if (inc === "fileMatch" && !s.pattern)
        issues.push({ level: "error", rule: "steering/pattern", file, msg: "inclusion: fileMatch needs fileMatchPattern" });
    }
    if (matches && s.inclusion === "fileMatch" && s.pattern && matches.get(name) === 0)
      issues.push({ level: "warn", rule: "steering/no-match", file, msg: `fileMatchPattern "${s.pattern}" matches no file in the repo` });
    const maxBytes = MAX_BYTES_BY_FILE[name] ?? STEERING_MAX_BYTES;
    if (bytes > maxBytes)
      issues.push({ level: "warn", rule: "steering/size", file, msg: `${bytes} bytes; keep under ${maxBytes} (split by topic or move detail to a manual file)` });
    const all = raw.split(/\r?\n/);
    const skip = fmMatch ? fmMatch[0].split(/\r?\n/).length : 0;
    const lines = all.map((l, i) => i < skip ? "" : l);
    let inFence = false;
    const ph = lines.findIndex((l) => {
      if (/^\s*```/.test(l)) {
        inFence = !inFence;
        return false;
      }
      return !inFence && /<[^>\s/][^>]*>/.test(l) && !/^\s*<\/?[a-z]+[\s>]/.test(l) && !/`[^`]*<[^`]*>[^`]*`/.test(l);
    });
    if (ph >= 0)
      issues.push({ level: "warn", rule: "steering/placeholder", file, line: ph + 1, msg: "template placeholder still present" });
    const thin = STEERING_THIN_BYTES[name] ?? THIN_TOPIC_BYTES;
    if (ph < 0 && bytes < thin && s.body.trim())
      issues.push({ level: "warn", rule: "steering/thin", file, msg: `${bytes} bytes; too thin to brief an agent. Aim ${STEERING_THIN_BYTES[name] ? "1.5\u20134" : "0.5\u20131.5"} KB of specific facts: names, versions, paths, limits, one bullet per fact` });
    const sections = [[]];
    lines.forEach((l, i) => {
      if (/^#{1,6}\s/.test(l))
        sections.push([]);
      else if (/^\s*-\s/.test(l))
        sections[sections.length - 1].push(i);
    });
    const packed = sections.find((b) => b.length === 1 && (lines[b[0]].match(/;/g) ?? []).length >= 2)?.[0];
    if (packed !== void 0)
      issues.push({ level: "warn", rule: "steering/packed", file, line: packed + 1, msg: "a whole section squashed into one semicolon-chained bullet; one bullet per fact" });
    let fence = -1, exempt = false;
    lines.forEach((l, i) => {
      if (/^\s*```/.test(l)) {
        if (fence < 0) {
          fence = i;
          exempt = /^\s*```schema\b/.test(l);
        } else {
          if (i - fence > 16 && !exempt)
            issues.push({ level: "warn", rule: "steering/code-dump", file, line: fence + 1, msg: `${i - fence - 1}-line code block; name the file instead so ctx can fetch it` });
          fence = -1;
        }
      }
    });
    if (!s.body.trim())
      issues.push({ level: "warn", rule: "steering/empty", file, msg: "empty" });
    if (ph < 0 && name === "structure.md" && !/^\s*```/m.test(s.body) && !/^\|.*\|\s*$/m.test(s.body))
      issues.push({ level: "warn", rule: "steering/shape", file, msg: "no tree or table: show the layout (a fenced tree with a comment per folder, a subfolder \u2192 responsibility table), not sentences about it. `steno steer template structure.md` shows the shape" });
    if (ph < 0 && name === "tech.md" && !/^\s*```(bash|sh|shell)?\s*$/m.test(s.body))
      issues.push({ level: "warn", rule: "steering/shape", file, msg: "no command block: list every script in a ```bash block with a comment each. `steno steer template tech.md` shows the shape" });
  }
  if (alwaysTokens > budget)
    issues.push({ level: "error", rule: "steering/budget", file: "steering", msg: `inclusion: always files total ~${alwaysTokens} tokens, over steeringBudget ${budget}; they enter every ctx packet. Shorten, or switch some to fileMatch` });
  return issues;
}
function steeringMatches(root, p = probe(root)) {
  const m = /* @__PURE__ */ new Map();
  for (const s of loadSteering(root))
    if (s.inclusion === "fileMatch" && s.pattern)
      m.set(s.file, globAny(p.files, splitPattern(s.pattern)).length);
  return m;
}
function lintSteering(root, p = probe(root)) {
  const cfg = loadConfig(root);
  const files = loadSteeringEntries(steeringRoot(root, cfg)).flatMap((e) => e.text !== void 0 ? [{ file: basename3(e.file), text: e.text }] : []);
  return lintSteeringFiles(files, cfg.steeringBudget, steeringMatches(root, p));
}

// ../core/dist/schema.js
var import_picomatch3 = __toESM(require_picomatch2(), 1);
import { readFileSync as readFileSync5 } from "node:fs";
import { join as join7, posix } from "node:path";
function splitTop(body) {
  const out2 = [];
  let depth = 0, cur = "";
  for (const ch of body) {
    if (ch === "(")
      depth++;
    else if (ch === ")")
      depth--;
    if (ch === "," && depth === 0) {
      out2.push(cur);
      cur = "";
    } else
      cur += ch;
  }
  if (cur.trim())
    out2.push(cur);
  return out2.map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean);
}
function matchParen(s, open) {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === "(")
      depth++;
    else if (s[i] === ")" && --depth === 0)
      return i;
  }
  return -1;
}
var SHORT_TYPE = [
  [/^uuid/i, "uuid"],
  [/^(text|varchar|character varying|char)\b/i, "text"],
  [/^(timestamptz|timestamp with time zone)/i, "ts"],
  [/^timestamp/i, "ts"],
  [/^date\b/i, "date"],
  [/^(bool|boolean)/i, "bool"],
  [/^(int|integer|int4|serial)\b/i, "int"],
  [/^(smallint|int2)/i, "int2"],
  [/^(bigint|int8|bigserial)/i, "int8"],
  [/^(numeric|decimal)\s*\(([^)]*)\)/i, "num($2)"],
  [/^(numeric|decimal)/i, "num"],
  [/^(double precision|float8|real|float4)/i, "float"],
  [/^jsonb?/i, "json"],
  [/^bytea/i, "bytes"]
];
function shortType(t) {
  t = t.replace(/^"?public"?\./i, "").replace(/^"([^"]+)"/, "$1");
  for (const [re, name] of SHORT_TYPE) {
    const m = re.exec(t);
    if (m)
      return name.replace("$2", (m[2] ?? "").replace(/\s/g, ""));
  }
  return t.split(/[\s(]/)[0].toLowerCase();
}
function parseColumn(def) {
  const m = /^"?([a-zA-Z_][\w]*)"?\s+(.+)$/.exec(def);
  if (!m)
    return void 0;
  const name = m[1], rest = m[2];
  if (/^(constraint|primary key|unique|foreign key|check|exclude)\b/i.test(def))
    return void 0;
  const ref = /references\s+("?\w+"?(?:\."?\w+"?)?)\s*\(\s*"?(\w+)"?\s*\)/i.exec(rest);
  return {
    name,
    type: shortType(rest),
    nullable: !/\bnot null\b/i.test(rest) && !/\bprimary key\b/i.test(rest),
    pk: /\bprimary key\b/i.test(rest),
    unique: /\bunique\b/i.test(rest),
    ref: ref ? { table: ref[1].replace(/"/g, "").replace(/^public\./, ""), column: ref[2] } : void 0,
    generated: /\bgenerated always as\b/i.test(rest) || void 0
  };
}
function applySql(sql, file, tables, enums) {
  const text = sql.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const tableName = (raw) => raw.replace(/"/g, "").replace(/^public\./i, "");
  const C = '(?:constraint\\s+"?\\w+"?\\s+)?';
  for (const m2 of text.matchAll(/create\s+type\s+("?\w+"?(?:\."?\w+"?)?)\s+as\s+enum\s*\(([^)]*)\)/gi)) {
    enums[tableName(m2[1])] = [...m2[2].matchAll(/'([^']*)'/g)].map((x) => x[1]);
  }
  for (const m2 of text.matchAll(/alter\s+type\s+("?\w+"?(?:\."?\w+"?)?)\s+add\s+value\s+(?:if\s+not\s+exists\s+)?'([^']*)'/gi)) {
    const k = tableName(m2[1]);
    (enums[k] ??= []).includes(m2[2]) || enums[k].push(m2[2]);
  }
  const ct = /create\s+table\s+(?:if\s+not\s+exists\s+)?("?[\w.]+"?)\s*\(/gi;
  let m;
  while (m = ct.exec(text)) {
    const open = m.index + m[0].length - 1, close = matchParen(text, open);
    if (close < 0)
      continue;
    const name = tableName(m[1]);
    const cols = [];
    const cons = {};
    const defs = splitTop(text.slice(open + 1, close));
    for (const d of defs) {
      const pk = new RegExp(`^${C}primary key\\s*\\(([^)]*)\\)`, "i").exec(d);
      const uq = new RegExp(`^${C}unique\\s*\\(([^)]*)\\)`, "i").exec(d);
      const fk = new RegExp(`^${C}foreign key\\s*\\(([^)]*)\\)\\s*references\\s+("?\\w+"?(?:\\."?\\w+"?)?)\\s*\\(([^)]*)\\)`, "i").exec(d);
      const cname = /^constraint\s+"?(\w+)"?/i.exec(d)?.[1];
      if (pk) {
        for (const c2 of pk[1].split(",")) {
          const col = cols.find((x) => x.name === c2.trim().replace(/"/g, ""));
          if (col) {
            col.pk = true;
            col.nullable = false;
          }
        }
        continue;
      }
      if (uq) {
        const names = uq[1].split(",").map((c2) => c2.trim().replace(/"/g, ""));
        if (names.length === 1) {
          const col = cols.find((x) => x.name === names[0]);
          if (col) {
            col.unique = true;
            if (cname)
              cons[cname] = { col: col.name, kind: "unique" };
          }
        } else {
          cols.push({ name: `uniq(${names.join(",")})`, type: "", nullable: false, pk: false, unique: true, note: "constraint" });
          if (cname)
            cons[cname] = { col: `uniq(${names.join(",")})`, kind: "unique" };
        }
        continue;
      }
      if (fk) {
        const first = (l) => l.split(",")[0].trim().replace(/"/g, "");
        const col = cols.find((x) => x.name === first(fk[1]));
        if (col) {
          col.ref = { table: tableName(fk[2]), column: first(fk[3]) };
          if (cname)
            cons[cname] = { col: col.name, kind: "fk" };
        }
        continue;
      }
      const c = parseColumn(d);
      if (c)
        cols.push(c);
    }
    tables.set(name, { name, columns: cols, file, cons });
    ct.lastIndex = close;
  }
  for (const a of text.matchAll(/alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?("?[\w.]+"?)\s+([\s\S]*?);/gi)) {
    const t = tables.get(tableName(a[1]));
    if (!t)
      continue;
    const renameTable = /^rename\s+to\s+("?[\w.]+"?)/i.exec(a[2].trim());
    if (renameTable) {
      tables.delete(t.name);
      t.name = tableName(renameTable[1]);
      tables.set(t.name, t);
      continue;
    }
    for (const action of splitTop(a[2])) {
      const rename = /^rename\s+(?:column\s+)?"?(\w+)"?\s+to\s+"?(\w+)"?/i.exec(action);
      if (rename) {
        const c = t.columns.find((x) => x.name === rename[1]);
        if (c)
          c.name = rename[2];
        continue;
      }
      const addPk = new RegExp(`^add\\s+${C}primary key\\s*\\(([^)]*)\\)`, "i").exec(action);
      if (addPk) {
        for (const n of addPk[1].split(",")) {
          const c = t.columns.find((x) => x.name === n.trim().replace(/"/g, ""));
          if (c) {
            c.pk = true;
            c.nullable = false;
          }
        }
        continue;
      }
      const alterCol = /^alter\s+(?:column\s+)?"?(\w+)"?\s+(.+)$/i.exec(action);
      if (alterCol) {
        const c = t.columns.find((x) => x.name === alterCol[1]);
        if (!c)
          continue;
        if (/^set\s+not\s+null/i.test(alterCol[2]))
          c.nullable = false;
        else if (/^drop\s+not\s+null/i.test(alterCol[2]))
          c.nullable = !c.pk;
        else if (/^(set\s+data\s+)?type\s+/i.test(alterCol[2]))
          c.type = shortType(alterCol[2].replace(/^(set\s+data\s+)?type\s+/i, ""));
        continue;
      }
      const add = /^add\s+(?:column\s+)?(?:if\s+not\s+exists\s+)?(.+)$/i.exec(action);
      const drop = /^drop\s+(?:column\s+)?(?:if\s+exists\s+)?"?(\w+)"?/i.exec(action);
      const fk = /^add\s+(?:constraint\s+"?(\w+)"?\s+)?foreign key\s*\(([^)]*)\)\s*references\s+("?\w+"?(?:\."?\w+"?)?)\s*\(([^)]*)\)/i.exec(action);
      const first = (l) => l.split(",")[0].trim().replace(/"/g, "");
      t.cons ??= {};
      if (fk) {
        const col = t.columns.find((x) => x.name === first(fk[2]));
        if (col) {
          col.ref = { table: tableName(fk[3]), column: first(fk[4]) };
          if (fk[1])
            t.cons[fk[1]] = { col: col.name, kind: "fk" };
        }
        continue;
      }
      const addUq = /^add\s+(?:constraint\s+"?(\w+)"?\s+)?unique\s*\(([^)]*)\)/i.exec(action);
      if (addUq) {
        const names = addUq[2].split(",").map((c) => c.trim().replace(/"/g, ""));
        if (names.length === 1) {
          const col = t.columns.find((x) => x.name === names[0]);
          if (col) {
            col.unique = true;
            if (addUq[1])
              t.cons[addUq[1]] = { col: col.name, kind: "unique" };
          }
        } else {
          const n = `uniq(${names.join(",")})`;
          if (!t.columns.some((c) => c.name === n))
            t.columns.push({ name: n, type: "", nullable: false, pk: false, unique: true, note: "constraint" });
          if (addUq[1])
            t.cons[addUq[1]] = { col: n, kind: "unique" };
        }
        continue;
      }
      const dropCon = /^drop\s+constraint\s+(?:if\s+exists\s+)?"?(\w+)"?/i.exec(action);
      if (dropCon) {
        let c = t.cons[dropCon[1]];
        if (!c) {
          const u = new RegExp(`^${t.name}_(\\w+)_unique$`).exec(dropCon[1]);
          const f = new RegExp(`^${t.name}_(\\w+)_\\w+_fk$`).exec(dropCon[1]);
          if (u)
            c = { col: u[1], kind: "unique" };
          else if (f)
            c = { col: t.columns.find((x) => f[1].startsWith(x.name))?.name ?? "", kind: "fk" };
        }
        if (c) {
          const col = t.columns.find((x) => x.name === c.col);
          if (col && c.kind === "unique") {
            if (col.note === "constraint")
              t.columns = t.columns.filter((x) => x !== col);
            else
              col.unique = false;
          } else if (col)
            col.ref = void 0;
          delete t.cons[dropCon[1]];
        }
        continue;
      }
      if (drop) {
        t.columns = t.columns.filter((c) => c.name !== drop[1]);
        continue;
      }
      if (add && !/^add\s+constraint/i.test(action)) {
        const c = parseColumn(add[1]);
        if (c && !t.columns.some((x) => x.name === c.name))
          t.columns.push(c);
      }
    }
  }
  for (const d of text.matchAll(/drop\s+table\s+(?:if\s+exists\s+)?("?[\w.]+"?)/gi))
    tables.delete(tableName(d[1]));
}
function applyPrisma(src, file, tables, enums) {
  for (const e of src.matchAll(/enum\s+(\w+)\s*\{([^}]*)\}/g))
    enums[e[1]] = e[2].split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("//"));
  const models = [...src.matchAll(/model\s+(\w+)\s*\{([^}]*)\}/g)].map((m) => m[1]);
  for (const m of src.matchAll(/model\s+(\w+)\s*\{([^}]*)\}/g)) {
    const cols = [];
    for (const line of m[2].split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("//") && !l.startsWith("@@"))) {
      const f = /^(\w+)\s+(\w+)(\[\])?(\?)?\s*(.*)$/.exec(line);
      if (!f)
        continue;
      const [, name, type, list, opt2, attrs] = f;
      if (models.includes(type)) {
        const rel2 = /@relation\([^)]*fields:\s*\[(\w+)\][^)]*references:\s*\[(\w+)\]/.exec(attrs);
        if (rel2) {
          const col2 = cols.find((c) => c.name === rel2[1]);
          if (col2)
            col2.ref = { table: type, column: rel2[2] };
          else
            cols.push({ name: rel2[1], type: "id", nullable: !!opt2, pk: false, unique: false, ref: { table: type, column: rel2[2] } });
        } else if (list)
          cols.push({ name, type: `${type}[]`, nullable: true, pk: false, unique: false, note: "back-relation" });
        continue;
      }
      const existing = cols.find((c) => c.name === name);
      const col = { name, type: shortType(type.toLowerCase()) === type.toLowerCase() ? type : shortType(type.toLowerCase()), nullable: !!opt2, pk: /@id\b/.test(attrs), unique: /@unique\b/.test(attrs), ref: existing?.ref };
      if (existing)
        Object.assign(existing, col);
      else
        cols.push(col);
    }
    tables.set(m[1], { name: m[1], columns: cols, file });
  }
}
function applyDrizzleSnapshot(json2, file, tables, enums) {
  const snap = JSON.parse(json2);
  for (const e of Object.values(snap.enums ?? {}))
    enums[e.name] = e.values;
  for (const t of Object.values(snap.tables)) {
    const cols = Object.values(t.columns).map((c) => ({ name: c.name, type: shortType(c.type), nullable: !c.notNull && !c.primaryKey, pk: !!c.primaryKey, unique: !!c.isUnique, generated: c.generated ? true : void 0 }));
    for (const pk of Object.values(t.compositePrimaryKeys ?? {}))
      for (const n of pk.columns) {
        const c = cols.find((x) => x.name === n);
        if (c) {
          c.pk = true;
          c.nullable = false;
        }
      }
    for (const u of Object.values(t.uniqueConstraints ?? {})) {
      if (u.columns.length === 1) {
        const c = cols.find((x) => x.name === u.columns[0]);
        if (c)
          c.unique = true;
      } else
        cols.push({ name: `uniq(${u.columns.join(",")})`, type: "", nullable: false, pk: false, unique: true, note: "constraint" });
    }
    for (const fk of Object.values(t.foreignKeys ?? {})) {
      const c = cols.find((x) => x.name === fk.columnsFrom[0]);
      if (c)
        c.ref = { table: fk.tableTo, column: fk.columnsTo[0] };
    }
    tables.set(t.name, { name: t.name, columns: cols, file });
  }
}
var TS_TYPE = { uuid: "uuid", text: "text", varchar: "text", char: "text", integer: "int", int: "int", smallint: "int2", bigint: "int8", serial: "int", bigserial: "int8", smallserial: "int2", boolean: "bool", timestamp: "ts", date: "date", time: "time", numeric: "num", decimal: "num", real: "float", doublePrecision: "float", json: "json", jsonb: "json", bytea: "bytes" };
function stripTsComments(src) {
  let out2 = "", q = null;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i], nx = src[i + 1];
    if (q) {
      out2 += ch;
      if (ch === q && src[i - 1] !== "\\")
        q = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      q = ch;
      out2 += ch;
      continue;
    }
    if (ch === "/" && nx === "/") {
      while (i < src.length && src[i] !== "\n")
        i++;
      out2 += "\n";
      continue;
    }
    if (ch === "/" && nx === "*") {
      const e = src.indexOf("*/", i + 2);
      i = e < 0 ? src.length : e + 1;
      continue;
    }
    out2 += ch;
  }
  return out2;
}
function applyDrizzleTs(src, file, tables, enums) {
  const text = stripTsComments(src);
  const enumConst = /* @__PURE__ */ new Map();
  for (const e of text.matchAll(/(?:const\s+(\w+)\s*=\s*)?(?:pg|mysql)Enum\(\s*["'](\w+)["']\s*,\s*\[([^\]]*)\]/g)) {
    enums[e[2]] = [...e[3].matchAll(/["']([^"']*)["']/g)].map((x) => x[1]);
    if (e[1])
      enumConst.set(e[1], e[2]);
  }
  const constToTable = /* @__PURE__ */ new Map();
  for (const m2 of text.matchAll(/(?:export\s+)?const\s+(\w+)\s*=\s*(?:pg|sqlite|mysql)Table\(\s*["'](\w+)["']/g))
    constToTable.set(m2[1], m2[2]);
  const re = /(?:export\s+)?const\s+(\w+)\s*=\s*(?:pg|sqlite|mysql)Table\(\s*["'](\w+)["']\s*,\s*\{/g;
  let m;
  while (m = re.exec(text)) {
    const open = text.indexOf("{", m.index + m[0].length - 1), close = matchBracket(text, open, "{", "}");
    if (close < 0)
      continue;
    const callOpen = text.indexOf("(", m.index + m[0].indexOf("Table("));
    const callClose = matchBracket(text, callOpen, "(", ")");
    const cols = [];
    for (const def of splitTopBraces(text.slice(open + 1, close))) {
      const f = /^(\w+)\s*:\s*(\w+)\(\s*(?:["']([\w]+)["'])?/.exec(def);
      if (!f)
        continue;
      const [, key, fn, colName] = f;
      const name = colName ?? key;
      const enumType = enumConst.get(fn) ?? (enums[fn] ? fn : void 0);
      const type = enumType ?? TS_TYPE[fn] ?? (/^\w+$/.test(fn) ? fn.toLowerCase() : "text");
      const precision = /(?:numeric|decimal)\([^)]*precision:\s*(\d+)(?:[^)]*scale:\s*(\d+))?/.exec(def);
      const ref = /\.references\(\s*\([^)]*\)\s*(?::\s*\w+)?\s*=>\s*(\w+)\.(\w+)/.exec(def);
      cols.push({
        name,
        type: precision ? `num(${precision[1]}${precision[2] ? "," + precision[2] : ""})` : type,
        nullable: !/\.notNull\(\)/.test(def) && !/\.primaryKey\(\)/.test(def),
        pk: /\.primaryKey\(\)/.test(def),
        unique: /\.unique\(\)/.test(def),
        ref: ref ? { table: constToTable.get(ref[1]) ?? ref[1], column: ref[2] } : void 0,
        generated: /\.generatedAlwaysAs\(/.test(def) || void 0
      });
    }
    const tail = callClose > close ? text.slice(close, callClose) : "";
    const byKey = (k) => cols.find((x) => x.name === snake(k) || x.name === k);
    for (const fk of tail.matchAll(/foreignKey\(\s*\{[^}]*columns:\s*\[([^\]]*)\][^}]*foreignColumns:\s*\[([^\]]*)\]/g)) {
      const from = /\w+\.(\w+)/.exec(fk[1]), to = /(\w+)\.(\w+)/.exec(fk[2]);
      const c = from && byKey(from[1]);
      if (c && to)
        c.ref = { table: constToTable.get(to[1]) ?? to[1], column: snake(to[2]) };
    }
    for (const pk of tail.matchAll(/primaryKey\(\s*\{\s*columns:\s*\[([^\]]*)\]/g))
      for (const k of pk[1].matchAll(/\w+\.(\w+)/g)) {
        const c = byKey(k[1]);
        if (c) {
          c.pk = true;
          c.nullable = false;
        }
      }
    for (const u of tail.matchAll(/\bunique\((?:["'][^"']*["'])?\)\s*\.on\(([^)]*)\)/g)) {
      const names = [...u[1].matchAll(/\w+\.(\w+)/g)].map((k) => byKey(k[1])?.name ?? snake(k[1]));
      if (names.length === 1) {
        const c = cols.find((x) => x.name === names[0]);
        if (c)
          c.unique = true;
      } else
        cols.push({ name: `uniq(${names.join(",")})`, type: "", nullable: false, pk: false, unique: true, note: "constraint" });
    }
    tables.set(m[2], { name: m[2], columns: cols, file });
    re.lastIndex = callClose > close ? callClose : close;
  }
}
var snake = (s) => s.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase());
function matchBracket(s, open, l, r) {
  let d = 0, q = null;
  for (let i = open; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === q && s[i - 1] !== "\\")
        q = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      q = ch;
      continue;
    }
    if (ch === l)
      d++;
    else if (ch === r && --d === 0)
      return i;
  }
  return -1;
}
function splitTopBraces(body) {
  const out2 = [];
  let depth = 0, cur = "", q = null;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (q) {
      cur += ch;
      if (ch === q && body[i - 1] !== "\\")
        q = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      q = ch;
      cur += ch;
      continue;
    }
    if ("([{".includes(ch))
      depth++;
    else if (")]}".includes(ch))
      depth--;
    if (ch === "," && depth === 0) {
      out2.push(cur);
      cur = "";
    } else
      cur += ch;
  }
  if (cur.trim())
    out2.push(cur);
  return out2.map((x) => x.replace(/\s+/g, " ").trim()).filter(Boolean);
}
function stripPy(src) {
  let out2 = "", i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '"' || ch === "'") {
      const tri = ch.repeat(3);
      if (src.startsWith(tri, i)) {
        const e = src.indexOf(tri, i + 3);
        const end = e < 0 ? src.length : e + 3;
        out2 += src.slice(i, end).replace(/[^\n]/g, "");
        i = end;
        continue;
      }
      let j = i + 1;
      while (j < src.length && src[j] !== ch && src[j] !== "\n")
        j += src[j] === "\\" ? 2 : 1;
      out2 += src.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if (ch === "#") {
      while (i < src.length && src[i] !== "\n")
        i++;
      continue;
    }
    out2 += ch;
    i++;
  }
  return out2;
}
function pyStatements(src) {
  const out2 = [];
  let cur = "", depth = 0, indent = 0;
  for (const line of src.split("\n")) {
    if (!cur && !line.trim())
      continue;
    if (!cur)
      indent = line.length - line.trimStart().length;
    let q = null;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) {
        if (ch === "\\")
          i++;
        else if (ch === q)
          q = null;
        continue;
      }
      if (ch === '"' || ch === "'")
        q = ch;
      else if ("([{".includes(ch))
        depth++;
      else if (")]}".includes(ch))
        depth--;
    }
    const cont = line.trimEnd().endsWith("\\");
    cur += (cur ? " " : "") + line.trim().replace(/\\$/, "");
    if (depth <= 0 && !cont) {
      out2.push({ indent, text: cur });
      cur = "";
      depth = 0;
    }
  }
  if (cur.trim())
    out2.push({ indent, text: cur });
  return out2;
}
function pyClasses(stmts, file) {
  const out2 = [];
  for (let i = 0; i < stmts.length; i++) {
    const s = stmts[i].text, m = /^class\s+(\w+)\s*/.exec(s);
    if (!m)
      continue;
    let head = "", rest = s.slice(m[0].length);
    if (rest.startsWith("(")) {
      const close = matchBracket(rest, 0, "(", ")");
      if (close < 0)
        continue;
      head = rest.slice(1, close);
      rest = rest.slice(close + 1);
    }
    const after = /^\s*:\s*(.*)$/.exec(rest);
    if (!after)
      continue;
    const body = after[1] ? [after[1]] : [];
    let level = -1;
    for (let j = i + 1; j < stmts.length && stmts[j].indent > stmts[i].indent; j++) {
      if (level < 0)
        level = stmts[j].indent;
      if (stmts[j].indent === level)
        body.push(stmts[j].text);
    }
    const args = splitTopBraces(head), pos = args.filter((a) => !/^\w+\s*=/.test(a)).map((a) => a.replace(/\[.*$/, "").trim());
    out2.push({ name: m[1], rawBases: pos, bases: pos.map((b) => b.split(".").pop()), kw: args.filter((a) => /^\w+\s*=/.test(a)).join(","), file, body });
  }
  return out2;
}
var SA_TYPE = {
  Integer: "int",
  INTEGER: "int",
  INT: "int",
  SmallInteger: "int2",
  SMALLINT: "int2",
  BigInteger: "int8",
  BIGINT: "int8",
  String: "text",
  Text: "text",
  TEXT: "text",
  Unicode: "text",
  UnicodeText: "text",
  VARCHAR: "text",
  NVARCHAR: "text",
  CHAR: "text",
  CITEXT: "text",
  Boolean: "bool",
  BOOLEAN: "bool",
  DateTime: "ts",
  DATETIME: "ts",
  TIMESTAMP: "ts",
  Date: "date",
  DATE: "date",
  Time: "time",
  TIME: "time",
  Interval: "interval",
  Float: "float",
  FLOAT: "float",
  REAL: "float",
  Double: "float",
  DOUBLE: "float",
  DOUBLE_PRECISION: "float",
  Numeric: "num",
  NUMERIC: "num",
  DECIMAL: "num",
  JSON: "json",
  JSONB: "json",
  UUID: "uuid",
  Uuid: "uuid",
  LargeBinary: "bytes",
  BYTEA: "bytes",
  BLOB: "bytes",
  INET: "inet"
};
var PY_TYPE = { int: "int", str: "text", bool: "bool", float: "float", Decimal: "num", datetime: "ts", date: "date", time: "time", timedelta: "interval", UUID: "uuid", bytes: "bytes", dict: "json", Dict: "json", list: "json", List: "json", Any: "json" };
var unquote = (s) => /^[rbuf]*["']([^"']*)["']$/i.exec(s.trim())?.[1];
function pyType(expr, col) {
  const m = /^(?:\w+\.)*(\w+)\s*(?:\(([\s\S]*)\))?$/.exec(expr.trim());
  if (!m)
    return;
  const [, fn, inner = ""] = m, args = splitTopBraces(inner);
  const kw = (k) => args.map((a) => new RegExp(`^${k}\\s*=\\s*(.+)$`).exec(a)?.[1]).find(Boolean);
  if (fn === "Enum" || fn === "ENUM") {
    const name = unquote(kw("name") ?? "");
    const cls = args.find((a) => /^[A-Za-z_][\w.]*$/.test(a))?.split(".").pop();
    if (cls)
      col.enumRef = { cls, byValue: !!kw("values_callable"), name };
    else
      col.enumLits = { name, values: args.map(unquote).filter((x) => x !== void 0) };
    return;
  }
  if (fn === "ARRAY") {
    const sub = { key: "", name: "", kind: "column", pk: false, unique: false };
    pyType(args[0] ?? "", sub);
    col.type = `${sub.type ?? "text"}[]`;
    return;
  }
  if (SA_TYPE[fn] === "num") {
    const pos = args.filter((a) => /^\d+$/.test(a)), p = kw("precision") ?? pos[0], s = kw("scale") ?? pos[1];
    col.type = p ? `num(${p}${s ? "," + s : ""})` : "num";
    return;
  }
  col.type = SA_TYPE[fn] ?? fn.toLowerCase();
}
function pyColArgs(args, col) {
  for (const a of splitTopBraces(args)) {
    if (a.startsWith("*"))
      continue;
    const kw = /^(\w+)\s*=\s*([\s\S]+)$/.exec(a);
    if (kw) {
      const [, k, v] = kw;
      if (k === "primary_key")
        col.pk = v === "True";
      else if (k === "nullable")
        col.nullable = v === "True";
      else if (k === "unique")
        col.unique = v === "True";
      else if (k === "foreign_key")
        col.fk = v;
      else if (k === "name")
        col.name = unquote(v) ?? col.name;
      else if (k === "type_" || k === "sa_type")
        pyType(v, col);
      else if (k === "sa_column") {
        const c = /^(?:\w+\.)*Column\s*\(([\s\S]*)\)$/.exec(v);
        if (c)
          pyColArgs(c[1], col);
      }
      continue;
    }
    const str = unquote(a);
    if (str !== void 0) {
      col.name = str;
      continue;
    }
    const fk = /^(?:\w+\.)*ForeignKey\s*\(\s*([^,)]+)/.exec(a);
    if (fk) {
      col.fk = fk[1].trim();
      continue;
    }
    if (/^(?:\w+\.)*Computed\s*\(/.test(a)) {
      col.generated = true;
      continue;
    }
    if (/^(?:\w+\.)*(Identity|Sequence|CheckConstraint|Index|FetchedValue)\s*\(/.test(a))
      continue;
    if (!col.type && !col.enumRef && !col.enumLits)
      pyType(a, col);
  }
}
function pyAnn(ann) {
  const unq = (x) => x.trim().replace(/^["']|["']$/g, "");
  let s = unq(ann), optional = false;
  const mapped = /^(?:\w+\.)*Mapped\[([\s\S]*)\]$/.exec(s);
  if (mapped)
    s = unq(mapped[1]);
  const o = /^(?:\w+\.)*Optional\[([\s\S]*)\]$/.exec(s);
  if (o) {
    s = o[1];
    optional = true;
  }
  const u = /^(?:\w+\.)*Union\[([\s\S]*)\]$/.exec(s);
  if (u) {
    const all = splitTopBraces(u[1]), parts = all.filter((x) => x !== "None");
    optional ||= parts.length < all.length;
    s = parts[0] ?? s;
  }
  if (/\|\s*None$|^None\s*\|/.test(s)) {
    s = s.replace(/\s*\|\s*None$|^None\s*\|\s*/, "");
    optional = true;
  }
  return { inner: unq(s), optional };
}
var pyAnnType = (inner) => PY_TYPE[inner.replace(/\[.*$/, "").split(".").pop()];
var COL_CALL = /^(\w+)\s*(?::\s*(.+?))?\s*=\s*(?:\w+\.)*(mapped_column|Column|Field)\s*\(/;
function pyModel(c) {
  const model = { abstract: false, cols: [], tableArgs: [] };
  const sqlmodel = /\btable\s*=\s*True/.test(c.kw);
  for (const s of c.body) {
    let m;
    if (m = /^__tablename__\s*(?::[^=]+)?=\s*(["'][^"']+["'])/.exec(s))
      model.table = unquote(m[1]);
    else if (/^__abstract__\s*=\s*True/.test(s))
      model.abstract = true;
    else if (m = /^__table_args__\s*(?::[^=]+)?=\s*([\s\S]+)$/.exec(s))
      model.tableArgs.push(m[1]);
    else if (m = COL_CALL.exec(s)) {
      const open = m[0].length - 1, close = matchBracket(s, open, "(", ")");
      const col = { key: m[1], name: m[1], kind: m[3] === "mapped_column" ? "mapped" : m[3] === "Column" ? "column" : "field", pk: false, unique: false };
      if (m[3] === "Field" && !sqlmodel)
        continue;
      if (m[2])
        col.ann = pyAnn(m[2]);
      pyColArgs(s.slice(open + 1, close < 0 ? s.length : close), col);
      model.cols.push(col);
    } else if ((m = /^(\w+)\s*:\s*(.+?)(?:\s*=\s*(.+))?$/.exec(s)) && !m[1].startsWith("__") && !/ClassVar/.test(m[2])) {
      const isMapped = /^(?:\w+\.)*Mapped\[/.test(m[2]);
      if (isMapped && !m[3] || sqlmodel && !isMapped && !(m[3] && /^(?:\w+\.)*\w+\s*\(/.test(m[3])))
        model.cols.push({ key: m[1], name: m[1], kind: "ann", ann: pyAnn(m[2]), pk: false, unique: false });
    }
  }
  return model;
}
function pyConstraints(text, cols) {
  const lits = (s) => [...s.matchAll(/["']([\w.]+)["']/g)].map((x) => x[1]);
  const calls = (fn) => [...text.matchAll(new RegExp(`\\b${fn}\\s*\\(`, "g"))].map((u) => {
    const open = u.index + u[0].length - 1;
    return splitTopBraces(text.slice(open + 1, matchBracket(text, open, "(", ")"))).filter((a) => !/^\w+\s*=/.test(a));
  });
  for (const args of calls("UniqueConstraint")) {
    const names = args.flatMap(lits);
    if (names.length === 1) {
      const c = cols.find((x) => x.name === names[0]);
      if (c)
        c.unique = true;
    } else if (names.length > 1)
      cols.push({ key: "", name: `uniq(${names.join(",")})`, kind: "column", pk: false, unique: true, note: "constraint" });
  }
  for (const args of calls("PrimaryKeyConstraint"))
    for (const n of args.flatMap(lits)) {
      const c = cols.find((x) => x.name === n);
      if (c)
        c.pk = true;
    }
  for (const args of calls("ForeignKeyConstraint")) {
    const from = lits(args[0] ?? "")[0], to = lits(args[1] ?? "")[0];
    const c = cols.find((x) => x.name === from);
    if (c && to)
      c.fk = `"${to}"`;
  }
}
function pyImports(stmts, file, pyFiles) {
  const out2 = /* @__PURE__ */ new Set();
  for (const s of stmts) {
    if (s.indent)
      continue;
    const m = /^from\s+(\.*)([\w.]*)\s+import\s+(.+)$/.exec(s.text);
    if (!m)
      continue;
    const names = m[3].replace(/[()]/g, "").split(",").map((x) => x.trim().split(/\s+as\s+/)[0]).filter((n) => /^\w+$/.test(n));
    const mod = m[2].replace(/\./g, "/");
    const wanted = (base) => [`${base}.py`, `${base}/__init__.py`, ...names.map((n) => `${base}/${n}.py`)].map((x) => x.replace(/^\/+/, ""));
    if (m[1]) {
      let d = posix.dirname(file);
      for (let k = 1; k < m[1].length; k++)
        d = posix.dirname(d);
      for (const w of wanted(posix.join(d, mod)))
        if (pyFiles.includes(w))
          out2.add(w);
    } else if (mod) {
      const ws = wanted(mod);
      for (const f of pyFiles)
        if (ws.some((w) => f === w || f.endsWith("/" + w)))
          out2.add(f);
    }
  }
  out2.delete(file);
  return [...out2];
}
function applySqlAlchemy(root, modelFiles, pyFiles, tables, enums) {
  const read = (f) => {
    try {
      return stripPy(readFileSync5(join7(root, f), "utf8"));
    } catch {
      return "";
    }
  };
  const classes = /* @__PURE__ */ new Map(), models = /* @__PURE__ */ new Map(), own = [];
  const core = [];
  const parsed2 = /* @__PURE__ */ new Set();
  const load = (f, isModel) => {
    if (parsed2.has(f))
      return [];
    parsed2.add(f);
    const stmts = pyStatements(read(f));
    for (const c of pyClasses(stmts, f)) {
      classes.set(c.name, c);
      models.set(c, pyModel(c));
      if (isModel)
        own.push(c);
    }
    if (isModel)
      for (const s of stmts) {
        const m = /^(\w+)\s*(?::[^=]+)?=\s*(?:\w+\.)*Table\s*\(\s*["'](\w+)["']\s*,/.exec(s.text);
        if (!m)
          continue;
        const open = s.text.indexOf("(", m[0].indexOf("Table")), close = matchBracket(s.text, open, "(", ")");
        const parts = splitTopBraces(s.text.slice(open + 1, close < 0 ? s.text.length : close)).slice(2), cols = [];
        for (const a of parts) {
          const c = /^(?:\w+\.)*Column\s*\(([\s\S]*)\)$/.exec(a);
          if (!c)
            continue;
          const col = { key: "", name: "", kind: "column", pk: false, unique: false };
          pyColArgs(c[1], col);
          if (col.name)
            cols.push(col);
        }
        core.push({ varName: m[1], table: m[2], file: f, cols, rest: parts.filter((a) => !/^(?:\w+\.)*Column\s*\(/.test(a)).join(",") });
      }
    return stmts;
  };
  const loaded = modelFiles.map((f) => [f, load(f, true)]);
  for (const [f, stmts] of loaded)
    for (const imp of pyImports(stmts, f, pyFiles))
      load(imp, false);
  const memo = /* @__PURE__ */ new Map();
  const tableOf = (c, seen = /* @__PURE__ */ new Set()) => {
    if (memo.has(c))
      return memo.get(c);
    if (seen.has(c))
      return void 0;
    seen.add(c);
    const mdl = models.get(c);
    let t = mdl.table;
    if (!t && !mdl.abstract) {
      const parentTabled = c.bases.some((b) => {
        const p = classes.get(b);
        return p && p !== c && tableOf(p, seen);
      });
      if (/\btable\s*=\s*True/.test(c.kw))
        t = c.name.toLowerCase();
      else if (!parentTabled && c.rawBases.some((b) => /^\w+\.Model$/.test(b)))
        t = snake(c.name).replace(/^_/, "");
    }
    memo.set(c, t);
    return t;
  };
  const inherited = (c, seen) => c.bases.flatMap((b) => {
    const p = classes.get(b);
    if (!p || seen.has(p) || tableOf(p))
      return [];
    seen.add(p);
    return [...models.get(p).cols, ...inherited(p, seen)];
  });
  const enumMembers = (cls, byValue) => {
    const c = classes.get(cls);
    if (!c || !c.bases.some((b) => /Enum$/.test(b)))
      return void 0;
    return c.body.map((s) => /^([A-Za-z_]\w*)\s*(?::[^=]+)?=\s*(.+)$/.exec(s)).filter((m) => !!m && !/^_.*_$/.test(m[1])).map((m) => byValue ? unquote(m[2]) ?? m[2] : m[1]);
  };
  const resolveFk = (raw) => {
    const lit = unquote(raw);
    if (lit !== void 0) {
      const parts = lit.split(".");
      const column = parts.pop();
      return parts.length ? { table: parts.join(".").replace(/^public\./, ""), column } : void 0;
    }
    const coreRef = /(\w+)\.c\.(\w+)$/.exec(raw);
    if (coreRef)
      return { table: core.find((t) => t.varName === coreRef[1])?.table ?? coreRef[1], column: coreRef[2] };
    const attr = /(\w+)\.(\w+)$/.exec(raw);
    if (!attr)
      return void 0;
    const target = classes.get(attr[1]), tm = target && tableOf(target);
    const col = target && [...models.get(target).cols, ...inherited(target, /* @__PURE__ */ new Set())].find((x) => x.key === attr[2]);
    return { table: tm ?? attr[1], column: col?.name ?? attr[2] };
  };
  const finish = (table, raw) => raw.map((r) => {
    let type = r.type;
    const annEnum = !type && !r.enumRef && !r.enumLits && r.ann && !pyAnnType(r.ann.inner) && enumMembers(r.ann.inner, false) ? r.ann.inner : void 0;
    const ref = r.enumRef ?? (annEnum ? { cls: annEnum, byValue: false, name: void 0 } : void 0);
    if (ref) {
      type = ref.name ?? ref.cls.toLowerCase();
      const v = enumMembers(ref.cls, ref.byValue);
      if (v)
        enums[type] = v;
    } else if (r.enumLits) {
      type = r.enumLits.name ?? `${table}_${r.name}`;
      enums[type] = r.enumLits.values;
    }
    type ??= r.ann ? pyAnnType(r.ann.inner) ?? r.ann.inner.toLowerCase() : "";
    const nullable = r.pk ? false : r.nullable ?? (r.kind === "column" ? true : r.ann ? r.ann.optional : true);
    return { name: r.name, type, nullable, pk: r.pk, unique: r.unique, ref: r.fk ? resolveFk(r.fk) : void 0, generated: r.generated, note: r.note };
  });
  for (const c of own) {
    const t = tableOf(c);
    if (!t)
      continue;
    const mdl = models.get(c), seen = /* @__PURE__ */ new Set([c]);
    const cols = [...mdl.cols];
    for (const x of inherited(c, seen))
      if (!cols.some((y) => y.key === x.key))
        cols.push({ ...x });
    const keep = cols.filter((x) => x.kind !== "ann" || pyAnnType(x.ann.inner) || enumMembers(x.ann.inner, false));
    for (const a of mdl.tableArgs)
      pyConstraints(a, keep);
    tables.set(t, { name: t, columns: finish(t, keep), file: c.file });
  }
  for (const t of core) {
    pyConstraints(t.rest, t.cols);
    tables.set(t.table, { name: t.table, columns: finish(t.table, t.cols), file: t.file });
  }
}
function extractSchema(root, p = probe(root)) {
  const tables = /* @__PURE__ */ new Map();
  const enums = {};
  const isPrisma = (0, import_picomatch3.default)("**/schema.prisma");
  const prisma = p.files.filter((f) => isPrisma(f));
  if (prisma.length) {
    for (const f of prisma)
      applyPrisma(readFileSync5(join7(root, f), "utf8"), f, tables, enums);
    return { source: "prisma", files: prisma, tables: [...tables.values()], enums };
  }
  const isSnap = (0, import_picomatch3.default)("**/meta/*_snapshot.json");
  const snaps = p.files.filter((f) => isSnap(f)).sort();
  if (snaps.length) {
    const latest = snaps[snaps.length - 1];
    applyDrizzleSnapshot(readFileSync5(join7(root, latest), "utf8"), latest, tables, enums);
    return { source: "drizzle-snapshot", files: [latest], tables: [...tables.values()], enums };
  }
  const isSql = (0, import_picomatch3.default)(["**/migrations/**/*.sql", "**/migrate/**/*.sql", "**/schema.sql", "**/db/**/*.sql", "**/database/**/*.sql", "**/supabase/**/*.sql", "**/drizzle/**/*.sql"]);
  const sql = p.files.filter((f) => isSql(f) && !/seed|rollback/i.test(f)).sort();
  if (sql.length) {
    for (const f of sql)
      applySql(readFileSync5(join7(root, f), "utf8"), f, tables, enums);
    return { source: "sql", files: sql, tables: [...tables.values()], enums };
  }
  const isTs = (0, import_picomatch3.default)(["**/schema.ts", "**/schema/*.ts", "**/db/**/*.ts", "**/drizzle/**/*.ts"]);
  const ts = p.files.filter((f) => isTs(f) && !/\.(test|spec)\./.test(f)).filter((f) => /\b(pg|sqlite|mysql)Table\(/.test(readFileSync5(join7(root, f), "utf8"))).sort();
  if (ts.length) {
    for (const f of ts)
      applyDrizzleTs(readFileSync5(join7(root, f), "utf8"), f, tables, enums);
    return { source: "drizzle-ts", files: ts, tables: [...tables.values()], enums };
  }
  const pyFiles = p.files.filter((f) => f.endsWith(".py"));
  const isPyModel = (f) => {
    if (/(^|\/)(migrations|alembic|versions|tests?)\//.test(f) || /(^|\/)(test_[^/]*|[^/]*_test|conftest)\.py$/.test(f))
      return false;
    let t = "";
    try {
      t = readFileSync5(join7(root, f), "utf8");
    } catch {
      return false;
    }
    return t.length < 512e3 && (/__tablename__|\btable\s*=\s*True|\(\s*\w+\.Model\s*[,)]/.test(t) || /\bTable\s*\(\s*["']\w+["']/.test(t)) && /\b(mapped_column|Column|Field)\s*\(|:\s*Mapped\[/.test(t);
  };
  const py = pyFiles.filter(isPyModel).sort();
  if (py.length) {
    applySqlAlchemy(root, py, pyFiles, tables, enums);
    if (tables.size)
      return { source: "sqlalchemy", files: py, tables: [...tables.values()], enums };
  }
  return { source: "none", files: [], tables: [], enums };
}
function formatSchema(s, opts = {}) {
  if (s.source === "none")
    return "no schema found (looked for schema.prisma, drizzle meta/*_snapshot.json, *.sql under migrations/, db/, database/, supabase/, drizzle/, Drizzle pgTable() files, and SQLAlchemy / SQLModel models)";
  const lines = [`# schema from ${s.source}: ${s.files.length} file${s.files.length === 1 ? "" : "s"}, ${s.tables.length} tables`];
  const singular = (t) => t.replace(/ies$/, "y").replace(/s$/, "");
  for (const t of s.tables) {
    const pk = t.columns.filter((c) => c.pk).map((c) => c.ref ? `${c.name}\u2192${c.ref.table}` : c.name).join(",");
    const parts = [];
    let ts = 0;
    for (const c of t.columns) {
      if (c.pk)
        continue;
      if (!opts.full && /^(created|updated|deleted)_at$/.test(c.name) && c.type === "ts") {
        ts++;
        continue;
      }
      if (c.note === "back-relation") {
        if (opts.full)
          parts.push(`${c.name}:${c.type}`);
        continue;
      }
      if (c.note === "constraint") {
        parts.push(c.name);
        continue;
      }
      if (c.ref) {
        const implied = c.name === `${singular(c.ref.table)}_id` || c.name === `${c.ref.table}_id` || c.name === `${c.ref.table.charAt(0).toLowerCase() + c.ref.table.slice(1)}Id`;
        parts.push(`${implied ? "" : c.name}\u2192${c.ref.table}${c.ref.column !== "id" ? "." + c.ref.column : ""}${c.nullable ? "?" : ""}`);
        continue;
      }
      parts.push(`${c.name}:${c.type}${c.generated ? "=gen" : ""}${c.unique ? "!" : ""}${c.nullable && !c.generated ? "?" : ""}`);
    }
    if (ts && !opts.full)
      parts.push(ts === 1 ? "created_at" : `${ts}\xD7ts`);
    lines.push(`${t.name}(${pk || "-"}): ${parts.join(", ")}`);
  }
  const en = Object.entries(s.enums);
  if (en.length)
    lines.push("", ...en.map(([k, v]) => `enum ${k}: ${v.join(" | ")}`));
  const children = /* @__PURE__ */ new Map();
  for (const t of s.tables)
    for (const c of t.columns)
      if (c.ref && c.ref.table !== t.name) {
        if (!children.has(c.ref.table))
          children.set(c.ref.table, /* @__PURE__ */ new Set());
        children.get(c.ref.table).add(t.name);
      }
  if (children.size)
    lines.push("", ...[...children.entries()].map(([p, kids]) => `${p} \u2190 ${[...kids].join(", ")}`));
  return lines.join("\n");
}

// ../core/dist/ctx.js
import { existsSync as existsSync6 } from "node:fs";
import { join as join8 } from "node:path";
var PATH_RE = /`([\w./-]+\/[\w./-]+\.[a-z]{1,6}|[\w-]+\.[a-z]{1,6})`/g;
function likelyFiles(projectRoot, ...texts) {
  const out2 = /* @__PURE__ */ new Set();
  for (const t of texts)
    for (const m of t.matchAll(PATH_RE)) {
      const p = m[1];
      if (existsSync6(join8(projectRoot, p)))
        out2.add(p);
      else if (p.includes("/") && !/^(https?:|\.\.)/.test(p))
        out2.add(`${p} (new)`);
    }
  return [...out2];
}
var TEST_DIRS = ["test", "tests", "__tests__", "spec"];
var IS_TEST = /(?:^|\/)(?:tests?|__tests__|spec)\/|[._](?:test|spec)\.[a-z]+$|(?:^|\/)test_[^/]+$/;
function testFilesFor(projectRoot, file) {
  if (IS_TEST.test(file))
    return [];
  const slash = file.lastIndexOf("/");
  const dir = slash < 0 ? "" : file.slice(0, slash + 1);
  const name = file.slice(slash + 1);
  const dot = name.lastIndexOf(".");
  if (dot <= 0)
    return [];
  const base = name.slice(0, dot), ext = name.slice(dot);
  const names = [`${base}.test${ext}`, `${base}.spec${ext}`, `${base}_test${ext}`, `test_${base}${ext}`];
  const src = /^((?:.*?\/)?)(?:src|lib|app)\/(.*)$/.exec(dir);
  const pkg = src ? src[1] : dir, inner = src ? src[2] : "";
  const candidates = [
    ...names.map((n) => dir + n),
    ...names.map((n) => `${dir}__tests__/${n}`),
    ...TEST_DIRS.flatMap((t) => names.flatMap((n) => [`${pkg}${t}/${inner}${n}`, `${pkg}${t}/${n}`]))
  ];
  return [...new Set(candidates)].filter((c) => existsSync6(join8(projectRoot, c)));
}
function truncateLines(body, keep, pointer) {
  const lines = body.split("\n");
  if (lines.length <= keep)
    return { text: body, cut: false };
  if (keep <= 0)
    return { text: `\u2026(${pointer})`, cut: true };
  return { text: lines.slice(0, keep).join("\n") + `
\u2026(${pointer})`, cut: true };
}
var FOOTER_LINE = /^\s*(?:_|\*\*)(?:Satisfies|Validates):/i;
var escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function filterToCriteria(body, critIds) {
  if (!critIds.length)
    return body;
  const nums = critIds.map((id) => id.replace(/^R/, ""));
  const re = new RegExp(`(?:^|[^\\w.])R?(?:${nums.map(escapeRe).join("|")})(?![\\w.])`);
  const lines = body.split("\n").filter((l) => !FOOTER_LINE.test(l));
  const hits = lines.filter((l, i) => i === 0 || re.test(l));
  return hits.length > 1 && hits.length < lines.length ? hits.join("\n") : lines.join("\n");
}
function buildCtx(spec, projectRoot, taskId, budget, opts = {}) {
  if (!spec.tasks)
    throw new Error("tasks.md does not exist yet");
  const task = findTask(spec.tasks, taskId);
  if (!task)
    throw new Error(`unknown task ${taskId}`);
  if (task.children.length && !task.checkpoint)
    return groupCtx(spec.tasks, task, budget);
  const parent = task.parent ? findTask(spec.tasks, task.parent) : void 0;
  const trimmed = [];
  const reqLines = [];
  const seenReq = /* @__PURE__ */ new Set();
  let refs = task.requirements.length ? task.requirements : parent?.requirements ?? [];
  let verifies = [];
  if (task.checkpoint && !task.requirements.length) {
    verifies = checkpointScope(spec.tasks.tasks, task);
    refs = [...new Set(verifies.flatMap((t) => t.requirements))];
  }
  const critIds = [];
  for (const ref of refs) {
    if (!spec.requirements)
      break;
    if (CRIT_ID.test(ref)) {
      const c = findCriterion(spec.requirements, ref);
      if (c) {
        reqLines.push(`${c.id} ${c.text}`);
        critIds.push(c.id);
      }
    } else {
      const r = findRequirement(spec.requirements, ref);
      if (r && !seenReq.has(r.id)) {
        seenReq.add(r.id);
        reqLines.push(`${r.id} ${r.title}${r.story ? ` \u2014 ${r.story}` : ""}`);
        for (const c of r.criteria) {
          reqLines.push(`  ${c.id} ${c.text}`);
          critIds.push(c.id);
        }
      }
    }
  }
  const reqText = reqLines.join("\n");
  const usedTerms = (spec.requirements?.glossary ?? []).filter((g) => new RegExp(`(?<![\\w])${escapeRe(g.term)}(?![\\w])`).test(reqText));
  const explicit = task.design.length ? task.design : task.checkpoint ? [] : parent?.design ?? [];
  const isProperty = (s) => /^property\b/i.test(s.heading) || /^D-prop/i.test(s.id ?? "");
  const blocks = [];
  const push = (id, primary) => {
    if (blocks.some((b) => b.id === id))
      return;
    const s = spec.design ? findSection(spec.design, id) : void 0;
    blocks.push(s ? { id, head: `### ${s.heading} {#${s.id}}`, body: s.body, primary: primary && !isProperty(s) } : { id, head: `### ${id} (not found)`, body: "", primary: false });
  };
  explicit.forEach((id) => push(id, true));
  if (blocks.length && !blocks.some((b) => b.primary))
    blocks[0].primary = true;
  if (!explicit.length && spec.design && !task.checkpoint) {
    const wanted = new Set(refs.map(reqOf));
    spec.design.sections.filter((s) => s.satisfies.some((x) => wanted.has(reqOf(x)))).forEach((s) => push(s.id, false));
    if (blocks.length)
      blocks[0].primary = true;
  }
  for (const b of blocks)
    if (!b.primary)
      b.body = filterToCriteria(b.body, critIds);
  let files = likelyFiles(projectRoot, task.title, ...blocks.map((b) => b.body));
  if (!files.length)
    files = likelyFiles(projectRoot, spec.design?.raw ?? "").filter((f) => !f.endsWith("(new)")).slice(0, 6);
  const tests = files.flatMap((f) => testFilesFor(projectRoot, f)).filter((t) => !files.includes(t));
  files = [...files, ...new Set(tests)];
  const matched = matchingSteering(opts.steering ?? [], files.map((f) => f.replace(/ \(new\)$/, "")));
  const omit = opts.omit ?? [];
  const steering = matched.filter((s) => !omit.some((o) => o.file === s.file));
  const omitted = omit.filter((o) => matched.some((s) => s.file === o.file) || !(opts.steering ?? []).some((s) => s.file === o.file)).map((o) => `steering/${o.file} (${o.reason})`);
  const shortDef = (d) => {
    const m = /^(.{0,90}?[.;:])\s/.exec(d + " ");
    return m ? m[1] : d.length > 90 ? d.slice(0, 87) + "\u2026" : d;
  };
  const render = (primaryKeep, secondaryKeep, steerKeep, terms, filesMax) => {
    const parts = [];
    parts.push(`# ${task.id} ${task.title}${parent ? `
(part of ${parent.id} ${parent.title})` : ""}`);
    const sibs = parent ? parent.children.map((c) => findTask(spec.tasks, c)).filter((t) => t.id !== task.id) : [];
    if (sibs.length)
      parts.push(`siblings: ${sibs.map((t) => `${t.id}${t.done ? "\u2713" : ""}`).join(" ")}`);
    if (task.optional)
      parts.push("optional task");
    if (task.checkpoint)
      parts.push(`## Verifies
${verifies.map((t) => `${t.id} ${t.title}${t.done ? " \u2713" : ""}`).join("\n") || "(no preceding tasks found)"}
Run the checks named in the task; every criterion below must hold end to end. Fix regressions before marking done.`);
    if (reqLines.length)
      parts.push(`## Requirements
${reqText}`);
    if (usedTerms.length && terms !== "none")
      parts.push(`## Terms
${usedTerms.map((g) => `${g.term}: ${terms === "full" ? g.definition : shortDef(g.definition)}`).join("\n")}`);
    else if (usedTerms.length) {
      parts.push(`## Terms
${usedTerms.map((g) => g.term).join(", ")} \u2026(steno show glossary)`);
      trimmed.push("glossary");
    }
    if (blocks.length) {
      parts.push("## Design\n" + blocks.map((b) => {
        const t = truncateLines(b.body, b.primary ? primaryKeep : secondaryKeep, `steno show ${b.id}`);
        if (t.cut)
          trimmed.push(b.id);
        return `${b.head}
${t.text}`;
      }).join("\n\n"));
    }
    if (files.length) {
      const shown = files.slice(0, filesMax);
      parts.push(`## Likely files
${shown.join("\n")}${files.length > shown.length ? `
\u2026+${files.length - shown.length} more (steno show ${blocks[0]?.id ?? "design"})` : ""}`);
    }
    if (steering.length) {
      parts.push("## Steering\n" + steering.map((s) => {
        const t = truncateLines(s.body, steerKeep, `steno show steering/${s.file}`);
        if (t.cut)
          trimmed.push(`steering/${s.file}`);
        return `[${s.file}]
${t.text}`;
      }).join("\n"));
    }
    parts.push(`## When finished
steno done ${task.id}`);
    return parts.join("\n\n");
  };
  const ladder = [
    [80, 40, 40, "full", 20],
    [80, 20, 12, "full", 20],
    [80, 8, 6, "full", 12],
    [80, 3, 3, "short", 12],
    [80, 1, 0, "short", 8],
    [80, 0, 0, "none", 8],
    [60, 0, 0, "none", 8],
    [40, 0, 0, "none", 6],
    [25, 0, 0, "none", 6],
    [12, 0, 0, "none", 4],
    [6, 0, 0, "none", 4]
  ];
  let text = "", tokens = 0;
  for (const [p, s, st, t, f] of ladder) {
    trimmed.length = 0;
    text = render(p, s, st, t, f);
    tokens = estimateTokens(text);
    if (tokens <= budget)
      break;
  }
  return { text, tokens, budget, trimmed: [.../* @__PURE__ */ new Set([...trimmed, ...omitted])], files };
}
function groupCtx(doc, task, budget) {
  const leaves = [];
  const walk = (p, optional) => {
    for (const id of p.children) {
      const c = findTask(doc, id);
      if (!c)
        continue;
      if (c.children.length)
        walk(c, optional || c.optional);
      else
        leaves.push({ t: c, optional: optional || c.optional });
    }
  };
  walk(task, false);
  const first = leaves.find((l) => !l.t.done && !l.optional)?.t;
  const parts = [`# ${task.id} ${task.title}`];
  if (first)
    parts.push(`Run each open subtask that is not optional, in order: \`steno ctx ${first.id}\`, implement, verify, \`steno done ${first.id}\`, then the next. Stop at the first that fails verification.`);
  parts.push(`## Subtasks
${leaves.map(({ t, optional }) => `${t.done ? "[x]" : "[ ]"} ${t.id} ${t.title}${optional ? " (optional)" : ""}`).join("\n")}`);
  parts.push(`## When finished
The last subtask's \`steno done\` ticks ${task.id} as well. While an optional subtask is still open, ${task.id} stays open; \`steno done ${task.id}\` closes it on purpose and ticks those subtasks too.`);
  const text = parts.join("\n\n");
  return { text, tokens: estimateTokens(text), budget, trimmed: [], files: [] };
}
function checkpointScope(all, cp) {
  const leaf = (t) => t.children.length === 0 && !t.checkpoint;
  const before = all.filter((t) => t.line < cp.line);
  if (cp.parent)
    return before.filter((t) => t.parent === cp.parent && leaf(t));
  const prevCp = [...before].reverse().find((t) => t.checkpoint && !t.parent);
  return before.filter((t) => leaf(t) && (!prevCp || t.line > prevCp.line));
}
function describeTask(t) {
  return `${t.done ? "[x]" : "[ ]"}${t.optional ? "*" : " "} ${t.id} ${t.title}`;
}

// ../core/dist/lint.js
var VAGUE = ["fast", "quick", "quickly", "easy", "easily", "user-friendly", "intuitive", "appropriate", "robust", "efficient", "seamless", "etc", "as needed", "properly"];
var ANY_VAGUE = new RegExp(`(?<= )(?:${VAGUE.join("|")})(?=[ ,.])`);
var EARS_START = /^(WHEN|IF|WHILE|WHERE|THE\b|THE SYSTEM)/i;
var MAX_WORDS = 35;
var MAX_CRITERIA = 60;
var MAX_CRITERIA_PER_REQ = 12;
var CODE_SPAN = /`([^`\n]+)`/g;
var IMPL_SMELL = /\/|\.(?:tsx?|jsx?|css|py|go|rs|kt|java)\b|\(|<[A-Z]|[a-z]+[A-Z][A-Za-z]|^[.#][a-z-]+$/;
var BARE_IMPL = /(?:^|[\s("'])((?:[a-z0-9_.-]+\/)+[a-z0-9_.-]+\.[a-z]{1,4}\b|(?:[a-z0-9_-]+\/){2,}[a-z0-9_-]+|[\w-]+\.(?:tsx?|jsx?|css|py|go|rs|kt|java)\b|[a-z][A-Za-z0-9]*\(\)|\b[a-z]+(?:[A-Z][a-z0-9]+)+\b)/g;
function reqIds(doc) {
  return { reqs: new Set(doc.requirements.map((r) => r.id)), crits: new Set(doc.requirements.flatMap((r) => r.criteria.map((c) => c.id))) };
}
function lintRequirements(doc, file = "requirements.md") {
  const out2 = [];
  if (doc.requirements.length === 0)
    out2.push({ level: "error", rule: "req/empty", file, msg: 'no requirements found (expected "### Requirement 1: Title" headings)' });
  const total = doc.requirements.reduce((n, r) => n + r.criteria.length, 0);
  if (total > MAX_CRITERIA)
    out2.push({ level: "warn", rule: "req/too-large", file, msg: `${total} criteria in one spec: it probably holds more than one deliverable; split it or cut what nothing needs yet (max ${MAX_CRITERIA})` });
  const terms = doc.glossary.map((g) => g.term);
  const seen = /* @__PURE__ */ new Set();
  for (const r of doc.requirements) {
    if (seen.has(r.id))
      out2.push({ level: "error", rule: "req/dup-id", file, line: r.line, id: r.id, msg: `duplicate id ${r.id}` });
    seen.add(r.id);
    if (!r.title)
      out2.push({ level: "warn", rule: "req/title", file, line: r.line, id: r.id, msg: "requirement has no title" });
    if (!r.story)
      out2.push({ level: "warn", rule: "req/story", file, line: r.line, id: r.id, msg: "missing **User Story:** line" });
    if (r.criteria.length === 0)
      out2.push({ level: "error", rule: "req/no-criteria", file, line: r.line, id: r.id, msg: "no acceptance criteria" });
    if (r.criteria.length > MAX_CRITERIA_PER_REQ)
      out2.push({ level: "warn", rule: "req/too-many-criteria", file, line: r.line, id: r.id, msg: `${r.criteria.length} criteria: split the requirement, or move cases to design or Non-goals (max ${MAX_CRITERIA_PER_REQ})` });
    for (const c of r.criteria) {
      if (!/\bSHALL\b/.test(c.text)) {
        if (/\bshall\b/.test(c.text))
          out2.push({ level: "warn", rule: "ears/shall-case", file, line: c.line, id: c.id, msg: "write SHALL in capitals" });
        else
          out2.push({ level: "error", rule: "ears/shall", file, line: c.line, id: c.id, msg: "acceptance criterion needs a SHALL clause" });
      }
      if (!EARS_START.test(c.text))
        out2.push({ level: "warn", rule: "ears/pattern", file, line: c.line, id: c.id, msg: "start with WHEN / IF / WHILE / WHERE / THE system (EARS)" });
      if ((c.text.match(/\bSHALL\b/g) ?? []).length > 1)
        out2.push({ level: "warn", rule: "ears/split", file, line: c.line, id: c.id, msg: "more than one SHALL: split into separate criteria" });
      for (const w of c.text.match(/\b[A-Z][a-z]+(?:_[A-Z][a-z]+)+\b/g) ?? [])
        if (terms.length && !terms.includes(w))
          out2.push({ level: "warn", rule: "ears/undefined-term", file, line: c.line, id: c.id, msg: `${w} is not in the Glossary` });
      const words = c.text.trim().split(/\s+/).length;
      if (words > MAX_WORDS)
        out2.push({ level: "warn", rule: "ears/too-long", file, line: c.line, id: c.id, msg: `${words} words: split it or drop detail that belongs in design (max ${MAX_WORDS})` });
      const bare = [...c.text.replace(CODE_SPAN, " ").matchAll(BARE_IMPL)].map((m) => m[1]);
      const impl = [.../* @__PURE__ */ new Set([...[...c.text.matchAll(CODE_SPAN)].map((m) => m[1]).filter((x) => IMPL_SMELL.test(x)), ...bare])].slice(0, 3);
      if (impl.length)
        out2.push({ level: "warn", rule: "ears/implementation", file, line: c.line, id: c.id, msg: `implementation detail in a requirement (${impl.join(", ")}) \u2014 say what the user sees; put the how in design.md` });
      const low = ` ${c.text.toLowerCase()} `;
      const vague = ANY_VAGUE.test(low) ? VAGUE.filter((v) => low.includes(` ${v} `) || low.includes(` ${v},`) || low.includes(` ${v}.`)) : [];
      if (vague.length)
        out2.push({ level: "warn", rule: "ears/vague", file, line: c.line, id: c.id, msg: `vague wording: ${vague.join(", ")} \u2014 make it testable` });
    }
  }
  return out2;
}
function lintDesign(doc, reqs, file = "design.md") {
  const out2 = [];
  if (doc.sections.length === 0)
    out2.push({ level: "error", rule: "design/empty", file, msg: "no sections found" });
  const ids = /* @__PURE__ */ new Set(), known = reqs && reqIds(reqs);
  for (const s of doc.sections) {
    if (ids.has(s.id))
      out2.push({ level: "error", rule: "design/dup-id", file, line: s.line, id: s.id, msg: `duplicate id ${s.id}` });
    ids.add(s.id);
    if (known)
      for (const ref of s.satisfies) {
        const ok = CRIT_ID.test(ref) ? known.crits.has(ref) : REQ_ID.test(ref) && known.reqs.has(ref);
        if (!ok)
          out2.push({ level: "error", rule: "design/unknown-req", file, line: s.line, id: s.id, msg: `_Satisfies_ references unknown ${ref}` });
      }
  }
  const MAX_PER_SECTION = 6, MAX_SECTIONS_PER_CRIT = 3;
  const NO_FOOTER = /^(overview|testing strategy|open questions)$/i;
  const byCrit = /* @__PURE__ */ new Map();
  for (const s of doc.sections) {
    if (s.satisfies.length > MAX_PER_SECTION)
      out2.push({ level: "warn", rule: "design/over-tagged", file, line: s.line, id: s.id, msg: `claims ${s.satisfies.length} criteria; tag only what this section implements (max ${MAX_PER_SECTION}) or split it` });
    if (s.satisfies.length && NO_FOOTER.test(s.heading))
      out2.push({ level: "warn", rule: "design/footer-on-overview", file, line: s.line, id: s.id, msg: `"${s.heading}" should not carry a _Satisfies_ footer; put traceability on the implementing sections` });
    for (const ref of s.satisfies)
      byCrit.set(ref, [...byCrit.get(ref) ?? [], s.id]);
  }
  for (const [ref, secs] of byCrit)
    if (secs.length > MAX_SECTIONS_PER_CRIT)
      out2.push({ level: "warn", rule: "design/overlap", file, id: ref, msg: `${ref} is claimed by ${secs.length} sections (${secs.join(", ")}); keep it on the one or two that implement it` });
  if (reqs) {
    const covered = new Set(doc.sections.flatMap((s) => s.satisfies.map(reqOf)));
    for (const r of reqs.requirements)
      if (!covered.has(r.id))
        out2.push({ level: "warn", rule: "design/uncovered-req", file, id: r.id, msg: `${r.id} "${r.title}" is not satisfied by any design section (_Satisfies: ${r.id}_)` });
  }
  return out2;
}
function lintTasks(doc, reqs, design, file = "tasks.md") {
  const out2 = [];
  if (doc.tasks.length === 0)
    out2.push({ level: "error", rule: "tasks/empty", file, msg: 'no tasks found (expected "- [ ] 1. Title")' });
  const ids = /* @__PURE__ */ new Set(), all = new Set(doc.tasks.map((t) => t.id));
  const known = reqs && reqIds(reqs), sections = design && new Set(design.sections.map((s) => s.id));
  for (const t of doc.tasks) {
    if (ids.has(t.id))
      out2.push({ level: "error", rule: "tasks/dup-id", file, line: t.line, id: t.id, msg: `duplicate task number ${t.num}` });
    ids.add(t.id);
    if (t.parent && !all.has(t.parent))
      out2.push({ level: "error", rule: "tasks/orphan", file, line: t.line, id: t.id, msg: `parent ${t.parent} does not exist` });
    if (isLeaf(t) && !t.checkpoint && t.requirements.length === 0)
      out2.push({ level: "warn", rule: "tasks/no-req", file, line: t.line, id: t.id, msg: "leaf task has no _Requirements: R?_ footer" });
    if (known)
      for (const ref of t.requirements) {
        const ok = CRIT_ID.test(ref) ? known.crits.has(ref) : known.reqs.has(ref);
        if (!ok)
          out2.push({ level: "error", rule: "tasks/unknown-req", file, line: t.line, id: t.id, msg: `references unknown ${ref}` });
      }
    if (sections)
      for (const ref of t.design) {
        if (!sections.has(ref))
          out2.push({ level: "error", rule: "tasks/unknown-design", file, line: t.line, id: t.id, msg: `references unknown design section ${ref}` });
      }
  }
  if (reqs) {
    const covered = new Set(doc.tasks.flatMap((t) => t.requirements.map(reqOf)));
    for (const r of reqs.requirements)
      if (!covered.has(r.id))
        out2.push({ level: "warn", rule: "tasks/uncovered-req", file, id: r.id, msg: `${r.id} "${r.title}" has no task` });
  }
  return out2;
}
var PLACEHOLDER = /<([A-Za-z0-9][^<>\n]*)>/g;
var HTML_TAG = /^(br|b|i|em|strong|code|sub|sup|hr|p)\/?$/i;
function lintPlaceholders(text, file) {
  const lines = [];
  let fenced = false;
  text.split(/\r?\n/).forEach((ln, i) => {
    if (/^\s*```/.test(ln)) {
      fenced = !fenced;
      return;
    }
    if (fenced)
      return;
    for (const m of ln.matchAll(PLACEHOLDER))
      if (!HTML_TAG.test(m[1]) && !/\w/.test(ln[m.index - 1] ?? "")) {
        lines.push(i + 1);
        break;
      }
  });
  if (!lines.length)
    return [];
  const shown = lines.slice(0, 5).join(", ") + (lines.length > 5 ? ", \u2026" : "");
  return [{ level: "error", rule: "spec/placeholder", file, line: lines[0], msg: `${lines.length} template placeholder line${lines.length > 1 ? "s" : ""} left (${shown}) \u2014 ${file} is still the skeleton; replace every <\u2026>` }];
}
function lintEmptySections(text, file) {
  const out2 = [];
  let fenced = false, open;
  const close = (level) => {
    if (open && level <= open.level)
      out2.push({ level: "warn", rule: "spec/empty-section", file, line: open.line, msg: `section "${open.heading}" is empty; fill it or delete the heading` });
    open = void 0;
  };
  text.split(/\r?\n/).forEach((ln, i) => {
    if (/^\s*```/.test(ln))
      fenced = !fenced;
    const m = fenced ? null : /^(#{1,4})\s+(.*?)(?:\s*\{#[\w-]+\})?\s*$/.exec(ln);
    if (!m) {
      if (ln.trim())
        open = void 0;
      return;
    }
    close(m[1].length);
    if (m[1].length > 1)
      open = { level: m[1].length, heading: m[2], line: i + 1 };
  });
  close(0);
  return out2;
}
function missingIssue(spec, stage) {
  const file = stage === "requirements" ? requirementsFile(spec.state) : `${stage}.md`;
  return { level: "error", rule: "spec/missing", file, msg: `${file} does not exist` };
}
var linted = /* @__PURE__ */ new Map();
var sameFiles = (a, b) => {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k]);
};
function lintSpec(spec, only) {
  if (only)
    return lintSpecNow(spec, only);
  const state = JSON.stringify(spec.state);
  const docs = [spec.requirements, spec.design, spec.tasks];
  const hit = linted.get(spec.root);
  if (hit && hit.state === state && hit.docs.every((d, i) => d === docs[i]) && sameFiles(hit.files, spec.files))
    return hit.issues.map((i) => ({ ...i }));
  const issues = lintSpecNow(spec);
  linted.set(spec.root, { state, files: { ...spec.files }, docs, issues });
  return issues.map((i) => ({ ...i }));
}
function lintSpecNow(spec, only) {
  const out2 = [];
  const reqFile = requirementsFile(spec.state);
  const STAGE_FILES = { requirements: reqFile, design: "design.md", tasks: "tasks.md" };
  for (const [stage, f] of Object.entries(STAGE_FILES))
    if ((!only || only === stage) && spec.files[f])
      out2.push(...lintPlaceholders(spec.files[f], f));
  for (const [stage, f] of Object.entries(STAGE_FILES))
    if ((!only || only === stage) && spec.files[f])
      out2.push(...lintEmptySections(spec.files[f], f));
  if ((!only || only === "requirements") && spec.requirements)
    out2.push(...lintRequirements(spec.requirements, reqFile));
  if ((!only || only === "design") && spec.design)
    out2.push(...lintDesign(spec.design, spec.requirements));
  if ((!only || only === "tasks") && spec.tasks)
    out2.push(...lintTasks(spec.tasks, spec.requirements, spec.design));
  if (only && !spec[only])
    out2.push(missingIssue(spec, only));
  if (!only && spec.state.phase !== "brief" && !spec.requirements)
    out2.push(missingIssue(spec, "requirements"));
  return out2;
}
function hasErrors(issues) {
  return issues.some((i) => i.level === "error");
}

// ../core/dist/trace.js
function traceMatrix(spec) {
  const rows = [];
  for (const r of spec.requirements?.requirements ?? []) {
    const design = (spec.design?.sections ?? []).filter((s) => s.satisfies.some((x) => reqOf(x) === r.id)).map((s) => s.id);
    const tasks = (spec.tasks?.tasks ?? []).filter((t) => t.requirements.some((x) => reqOf(x) === r.id));
    rows.push({ req: r.id, title: r.title, criteria: r.criteria.length, design, tasks: tasks.map((t) => t.id), tasksDone: tasks.filter((t) => t.done).length });
  }
  return rows;
}
function traceCriteria(spec) {
  const rows = [];
  for (const r of spec.requirements?.requirements ?? [])
    for (const c of r.criteria) {
      const tasks = (spec.tasks?.tasks ?? []).filter((t) => t.requirements.includes(c.id) || t.requirements.includes(r.id)).map((t) => t.id);
      const design = (spec.design?.sections ?? []).filter((s) => s.satisfies.includes(c.id) || s.satisfies.includes(r.id)).map((s) => s.id);
      rows.push({ crit: c.id, text: c.text, tasks, design });
    }
  return rows;
}

// ../core/dist/importKiro.js
import { existsSync as existsSync7, readFileSync as readFileSync6, readdirSync as readdirSync4, writeFileSync as writeFileSync5, mkdirSync as mkdirSync5 } from "node:fs";
import { basename as basename4, join as join9 } from "node:path";
function normalizeKiroRequirements(raw) {
  return raw.replace(/^###\s+Requirement\s+(\d+)\s*(?:[:\-–]\s*(.*?))?\s*$/gim, (_m, n, t) => `## R${n} ${(t ?? "").trim()}`.trimEnd()).replace(/^####\s+Acceptance Criteria\s*$/gim, "### Acceptance Criteria");
}
function normalizeKiroTasks(raw) {
  return raw.replace(/_Requirements:\s*([^_]*)_/gi, (_m, refs) => `_Requirements: ${refs.split(",").map((s) => s.trim()).filter(Boolean).map((s) => /^\d/.test(s) ? `R${s}` : s).join(", ")}_`);
}
function importKiroSpec(projectRoot, from, name = basename4(from)) {
  if (!existsSync7(from))
    throw new Error(`no such directory: ${from}`);
  try {
    assertSlug(name);
  } catch (e) {
    throw new Error(`${e.message}; pass a slug: steno import <dir> <slug>`);
  }
  const dir = specDir(projectRoot, name);
  if (isSpecDir(dir))
    throw new Error(`spec already exists: ${dir}`);
  mkdirSync5(join9(dir, "reviews"), { recursive: true });
  const files = [];
  for (const f of readdirSync4(from)) {
    if (!f.endsWith(".md"))
      continue;
    let text = readFileSync6(join9(from, f), "utf8");
    if (f === "requirements.md" || f === "bugfix.md")
      text = normalizeKiroRequirements(text);
    if (f === "tasks.md")
      text = normalizeKiroTasks(text);
    writeFileSync5(join9(dir, f), text);
    files.push(f);
  }
  saveState(dir, stateFromArtifacts(name, dir));
  return { dir, files, issues: lintSpec(loadSpec(dir)).length };
}

// ../core/dist/agents.js
import { cpSync, symlinkSync } from "node:fs";
import { dirname as dirname2, resolve as resolve3 } from "node:path";
var AGENTS = [
  { key: "codex", label: "OpenAI Codex CLI", skillsDir: ".agents/skills", native: true },
  { key: "opencode", label: "OpenCode", skillsDir: ".agents/skills", native: true },
  { key: "antigravity", label: "Google Antigravity", skillsDir: ".agents/skills", native: true },
  { key: "claude", label: "Claude Code", skillsDir: ".claude/skills", subagentsDir: ".claude/agents" },
  { key: "cursor", label: "Cursor", skillsDir: ".cursor/skills" },
  { key: "copilot", label: "GitHub Copilot", skillsDir: ".github/skills" },
  { key: "gemini", label: "Gemini CLI", skillsDir: ".gemini/skills" },
  { key: "kiro", label: "Kiro", skillsDir: ".kiro/skills", note: "set specsDir: .kiro/specs in .steno/config.yaml to share specs with Kiro" }
];
function agentByKey(key) {
  return AGENTS.find((a) => a.key === key);
}
var REVIEWER_AGENT_PREFIX = "steno-reviewer-";
function reviewerAgent(persona, personaText) {
  const name = `${REVIEWER_AGENT_PREFIX}${persona}`;
  const stages = /\(stages:\s*([^)]+)\)/.exec(personaText)?.[1].trim() ?? "any";
  const content = [
    "---",
    `name: ${name}`,
    `description: steno fresh-context reviewer (${persona}) for a spec review packet. Stages - ${stages}. Read-only. Give it only the packet path.`,
    "tools: Read, Grep, Glob",
    "---",
    "",
    personaText.trim(),
    "",
    "You are read-only: never create or edit a file. You are given the path of one review packet. Read it; read other files only when your instructions above say to read the source files the packet lists. Reply with the findings in the output format above and nothing else.",
    ""
  ].join("\n");
  return { file: `${name}.md`, content };
}
function linkOrCopy(target, dst, copy, link = symlinkSync) {
  const abs = resolve3(dirname2(dst), target);
  if (!copy) {
    try {
      link(target, dst);
      return "link";
    } catch (e) {
      if (e.code !== "EPERM")
        throw e;
    }
  }
  cpSync(abs, dst, { recursive: true });
  return "copy";
}

// ../core/dist/review.js
import { existsSync as existsSync8, readFileSync as readFileSync7, writeFileSync as writeFileSync6, mkdirSync as mkdirSync6 } from "node:fs";
import { join as join10 } from "node:path";
var MAX_REVIEW_ROUNDS = 2;
var REVIEW_GROWTH_WARN = 0.25;
var UNIT = { requirements: "criteria", design: "sections", tasks: "tasks" };
function reviewItems(spec, stage) {
  const out2 = {};
  if (stage === "requirements")
    for (const r of spec.requirements?.requirements ?? [])
      for (const c of r.criteria)
        out2[c.id] = sha(c.text.trim());
  if (stage === "design") {
    for (const s of spec.design?.sections ?? [])
      if (s.id)
        out2[s.id] = sha(`${s.heading}
${s.body.trim()}`);
  }
  if (stage === "tasks" && spec.tasks) {
    const lines = spec.tasks.raw.split(/\r?\n/), tasks = spec.tasks.tasks;
    tasks.forEach((t, i) => {
      out2[t.id] = sha(taskText(lines, t.line, tasks[i + 1]?.line ?? lines.length + 1));
    });
  }
  return out2;
}
function taskText(lines, line, nextLine) {
  const own = [lines[line - 1].replace(/\[[ xX]\]/, "[ ]")];
  for (let i = line; i < nextLine - 1 && !/^#{1,2}\s/.test(lines[i]); i++)
    own.push(lines[i]);
  return own.map((l) => l.trimEnd()).join("\n").trim();
}
var logPath = (specRoot, stage) => join10(specRoot, "reviews", `${stage}-rounds.json`);
function loadReviewLog(specRoot, stage) {
  try {
    const log = JSON.parse(readFileSync7(logPath(specRoot, stage), "utf8"));
    if (Array.isArray(log.rounds) && log.items && typeof log.items === "object")
      return log;
  } catch {
  }
  return { rounds: [], items: {} };
}
function saveReviewLog(specRoot, stage, log) {
  mkdirSync6(join10(specRoot, "reviews"), { recursive: true });
  writeFileSync6(logPath(specRoot, stage), JSON.stringify(log, null, 1) + "\n");
}
function saveReviewSnapshot(specRoot, stage, round, doc) {
  mkdirSync6(join10(specRoot, "reviews"), { recursive: true });
  const p = join10(specRoot, "reviews", `${stage}-round${round}.md`);
  writeFileSync6(p, doc);
  return p;
}
function nextReviewRound(spec, stage, doc, opts = {}) {
  const prev = opts.full ? { rounds: [], items: {} } : loadReviewLog(spec.root, stage);
  const items = reviewItems(spec, stage);
  const count = Object.keys(items).length, docSha = sha(doc);
  const last = prev.rounds.at(-1);
  const firstCount = prev.rounds[0]?.count ?? count;
  if (last && last.sha === docSha)
    return { round: last.round, verify: last.round > 1, unchanged: true, count, firstCount, overLimit: last.round > MAX_REVIEW_ROUNDS, log: prev };
  const round = (last?.round ?? 0) + 1;
  const delta = last ? {
    added: Object.keys(items).filter((id) => !(id in prev.items)),
    changed: Object.keys(items).filter((id) => id in prev.items && prev.items[id] !== items[id]),
    removed: Object.keys(prev.items).filter((id) => !(id in items))
  } : void 0;
  const log = { rounds: [...prev.rounds, { round, date: opts.date ?? (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), sha: docSha, count }], items };
  return { round, verify: round > 1, unchanged: false, count, firstCount, delta, overLimit: round > MAX_REVIEW_ROUNDS, log };
}
function reviewSize(r, stage) {
  const d = r.count - r.firstCount;
  return `${r.count} ${UNIT[stage]}${r.round > 1 ? ` (round 1: ${r.firstCount}, ${d >= 0 ? "+" : ""}${d})` : ""}`;
}
function reviewGrew(r) {
  return r.firstCount > 0 && (r.count - r.firstCount) / r.firstCount > REVIEW_GROWTH_WARN;
}
function reviewRoundSection(r, stage) {
  const lines = [`## Review round ${r.round} (${r.verify ? "verify" : "full"})`, `Size: ${reviewSize(r, stage)}.`];
  if (r.verify && r.delta) {
    const list = (label, ids) => ids.length ? `${label}: ${ids.join(", ")}` : "";
    const changes = [list("added", r.delta.added), list("changed", r.delta.changed), list("removed", r.delta.removed)].filter(Boolean).join("; ");
    lines.push(`Since round ${r.round - 1}: ${changes || `no ${UNIT[stage]} changed; only the surrounding text did`}.`);
    lines.push("This is a verify round. Report only a contradiction, a gap or an untestable statement that is in the added and changed items or that they cause elsewhere, plus any high finding. Report nothing med or low on items that did not change.");
  }
  return lines.join("\n");
}
function reviewDecisions(specRoot, stage) {
  const p = join10(specRoot, "reviews", `${stage}-decisions.md`);
  const text = existsSync8(p) ? readFileSync7(p, "utf8").trim() : "";
  return text || void 0;
}

// ../core/dist/check.js
import { statSync as statSync3 } from "node:fs";
import { join as join11 } from "node:path";
var APPROVABLE = ["brief", "requirements", "design", "tasks"];
var isDir2 = (p) => {
  try {
    return statSync3(p).isDirectory();
  } catch {
    return false;
  }
};
var given = (v) => typeof v === "string" && v !== "";
var invalid = (field, message) => new StenoError("invalid-request", message, { field });
var isUsable = (e) => "spec" in e;
function validBudget(b) {
  if (b === void 0 || b === null || b === "")
    return true;
  const n = typeof b === "string" ? Number(b) : b;
  return typeof n === "number" && Number.isInteger(n) && n > 0;
}
function defaultSpec(snap) {
  if (snap.specs.length === 1)
    return snap.specs[0];
  const active = snap.specs.filter((e) => !isUsable(e) || e.spec.state.phase !== "done");
  return active.length === 1 ? active[0] : void 0;
}
function unusableError(e) {
  const first = e.files[0];
  return new StenoError(e.flag, `${e.name}: ${first?.reason ?? e.flag}`, { spec: e.name, file: first?.file, reason: first?.reason });
}
function check(req2, snap, opts) {
  const name = given(req2.spec) ? req2.spec : void 0;
  const taskId = "task" in req2 && given(req2.task) ? req2.task : void 0;
  if (!opts.cli && !name)
    throw invalid("spec", "the request names no spec");
  if ((req2.kind === "packet" || req2.kind === "done" || req2.kind === "reopen") && !taskId)
    throw invalid("task", "the request names no task");
  if (req2.kind === "approve" && !given(req2.phase))
    throw invalid("phase", "the request names no phase");
  if (req2.kind === "packet" && !validBudget(req2.budget))
    throw invalid("budget", `budget must be a positive whole number of tokens, got ${JSON.stringify(req2.budget)}`);
  if (!snap.setUp && (!opts.cli || isDir2(join11(snap.root, ".steno"))))
    throw new StenoError("not-set-up", snap.reason ?? `${snap.root} is not set up; run steno init`, { reason: snap.reason });
  const names = snap.specs.map((e) => e.name);
  let entry;
  if (name) {
    entry = snap.specs.find((e) => e.name === name);
    if (!entry)
      throw new StenoError("not-found", `unknown spec "${name}"${names.length ? ` (have: ${names.join(", ")})` : ""}`, { spec: name });
  }
  if (entry) {
    if (!isUsable(entry) && req2.kind !== "lint")
      throw unusableError(entry);
  } else {
    const bad = [...snap.specs].sort((a, b) => a.name.localeCompare(b.name)).find((e) => !isUsable(e));
    if (bad)
      throw unusableError(bad);
    entry = defaultSpec(snap);
    if (!entry)
      throw invalid("spec", names.length ? `several specs; pass one of: ${names.join(", ")}` : `no specs under ${snap.config.specsDir}. Run: steno new <slug>`);
  }
  let task;
  if (taskId && isUsable(entry)) {
    const doc = entry.spec.tasks;
    if (!doc)
      throw new StenoError("not-found", `${entry.name}: tasks.md does not exist yet`, { spec: entry.name, file: join11(entry.spec.root, "tasks.md") });
    task = findTask(doc, taskId);
    if (!task)
      throw new StenoError("not-found", `${entry.name}: unknown task ${taskId}`, { spec: entry.name, field: "task" });
  }
  if (req2.kind === "approve" && isUsable(entry)) {
    const phase = req2.phase;
    const reason = !APPROVABLE.includes(phase) ? `phase must be ${APPROVABLE.join("|")}, got "${phase}"` : approvalError(entry.spec.state, phase);
    if (reason)
      throw new StenoError("invalid-request", reason, { field: "phase", spec: entry.name, reason });
  }
  if (req2.kind === "reopenSpec" && isUsable(entry) && entry.spec.state.phase !== "done") {
    const reason = `${entry.name} is in phase ${entry.spec.state.phase}; only a done spec can be reopened`;
    throw new StenoError("invalid-request", reason, { field: "spec", spec: entry.name, reason });
  }
  if (opts.unsaved && isUsable(entry) && req2.kind !== "read" && req2.kind !== "lint") {
    const dir = entry.spec.root;
    const paths = req2.kind === "done" || req2.kind === "reopen" ? [join11(dir, "tasks.md"), join11(dir, STATE_FILE)] : req2.kind === "reopenSpec" ? [join11(dir, STATE_FILE)] : [...ARTIFACTS.map((f) => join11(dir, f)), ...req2.kind === "approve" ? [join11(dir, STATE_FILE)] : []];
    const hit = opts.unsaved(paths);
    if (hit)
      throw new StenoError("unsaved-edits", `${hit} has unsaved edits; save it first`, { spec: entry.name, file: hit });
  }
  return task ? { entry, task } : { entry };
}

// ../core/dist/change.js
import { readFileSync as readFileSync8, renameSync, rmSync, writeFileSync as writeFileSync7 } from "node:fs";
import { join as join13 } from "node:path";

// ../core/dist/diagnostics.js
import { basename as basename5, join as join12, relative as relative3, sep } from "node:path";
var rel = (snap, abs) => relative3(snap.root, abs).split(sep).join("/");
var severity = (i) => i.level === "error" ? "error" : "warning";
function specDiagnostics(snap, name, only) {
  const entry = snap.specs.find((e) => e.name === name);
  if (!entry || !("spec" in entry))
    return [];
  const { spec } = entry;
  return lintSpec(spec, only).map((i) => {
    const exists = spec.files[i.file] !== void 0;
    return {
      file: rel(snap, join12(spec.root, exists ? i.file : STATE_FILE)),
      line: exists ? i.line ?? 1 : 1,
      severity: severity(i),
      rule: i.rule,
      message: i.msg,
      spec: name
    };
  });
}
function steeringDiagnostics(snap, matches) {
  if (!snap.setUp)
    return [];
  const readable = snap.steering.filter((e) => e.text !== void 0);
  const byName = new Map(readable.map((e) => [basename5(e.file), e.file]));
  const files = readable.map((e) => ({ file: basename5(e.file), text: e.text }));
  const config = rel(snap, configPath(snap.root));
  return lintSteeringFiles(files, snap.config.steeringBudget, matches).map((i) => {
    const path2 = i.file.startsWith("steering/") ? byName.get(i.file.slice("steering/".length)) : void 0;
    return {
      file: path2 ? rel(snap, path2) : config,
      line: path2 ? i.line ?? 1 : 1,
      severity: severity(i),
      rule: i.rule,
      message: i.msg
    };
  });
}
function readDiagnostics(snap) {
  const config = rel(snap, configPath(snap.root));
  if (!snap.setUp) {
    const unreadable = snap.reason?.startsWith(".steno/config.yaml");
    return unreadable ? [{ file: config, line: 1, severity: "error", rule: "config/unreadable", message: snap.reason }] : [];
  }
  const out2 = [];
  for (const e of snap.specs) {
    if ("spec" in e)
      continue;
    for (const f of e.files)
      out2.push({ file: rel(snap, f.file), line: 1, severity: "error", rule: `spec/${e.flag}`, message: f.reason, spec: e.name });
  }
  for (const e of snap.steering) {
    if (e.unreadable !== void 0)
      out2.push({ file: rel(snap, e.file), line: 1, severity: "error", rule: "steering/unreadable", message: e.unreadable });
  }
  return out2;
}
function configDiagnostics(snap) {
  if (!snap.setUp)
    return [];
  const file = rel(snap, configPath(snap.root));
  return snap.configWarnings.map((w) => w.kind === "unknown-key" ? { file, line: w.line, severity: "warning", rule: "config/unknown-key", message: `unknown key "${w.key}" is ignored` } : { file, line: w.line, severity: "warning", rule: "config/invalid-value", message: `invalid value for "${w.key}"; using the default ${JSON.stringify(w.default)}` });
}

// ../core/dist/change.js
var defaultWriter = (path2, bytes) => {
  const tmp = `${path2}.steno-${process.pid}.tmp`;
  try {
    writeFileSync7(tmp, bytes);
    renameSync(tmp, path2);
  } catch (e) {
    rmSync(tmp, { force: true });
    throw e;
  }
};
var BOM2 = Buffer.from([239, 187, 191]);
var today = () => (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
var readBytes = (path2) => {
  try {
    return readFileSync8(path2);
  } catch (e) {
    if (e.code === "ENOENT")
      return void 0;
    throw e;
  }
};
function usable(snap, name) {
  const e = snap.specs.find((x) => x.name === name);
  if (!e)
    throw new StenoError("not-found", `unknown spec "${name}"`, { spec: name });
  if (!("spec" in e))
    throw new StenoError(e.flag, `${name}: ${e.files[0]?.reason ?? e.flag}`, { spec: name, file: e.files[0]?.file, reason: e.files[0]?.reason });
  return e;
}
function workingState(e) {
  const s = structuredClone(e.spec.state);
  if (e.derived) {
    s.created = today();
    for (const k of Object.keys(s.approvals))
      s.approvals[k] = today();
  }
  return s;
}
function writeAll(files, write) {
  const touched = [];
  try {
    for (const f of files) {
      touched.push(f);
      const body = Buffer.from(f.text, "utf8");
      write(f.path, f.original?.subarray(0, 3).equals(BOM2) ? Buffer.concat([BOM2, body]) : body);
    }
  } catch (cause) {
    const left = [];
    for (const f of touched) {
      try {
        if (f.original)
          writeFileSync7(f.path, f.original);
        else
          rmSync(f.path, { force: true });
      } catch {
        left.push(f.path);
      }
    }
    if (left.length)
      throw new StenoError("failed", `the change failed and could not be undone; left changed: ${left.join(", ")}`, { reason: cause?.message });
    if (cause instanceof StenoError)
      throw cause;
    throw new StenoError("failed", `the change failed, nothing was changed: ${cause?.message ?? String(cause)}`);
  }
}
function storedPhase(bytes) {
  if (!bytes)
    return void 0;
  const read = parseState(bytes.toString("utf8").replace(/^\uFEFF/, ""));
  return "state" in read ? read.state.phase : void 0;
}
function applyTaskChange(snap, spec, task, done, opts = {}) {
  const e = usable(snap, spec);
  const doc = e.spec.tasks;
  if (!doc)
    throw new StenoError("not-found", `${spec}: tasks.md does not exist yet`, { spec });
  const tasksPath = join13(e.spec.root, "tasks.md"), statePath = join13(e.spec.root, STATE_FILE);
  const originals = { tasks: readBytes(tasksPath), state: readBytes(statePath) };
  const text = setTaskDone(doc, task, done);
  const state = workingState(e);
  const moved = syncDonePhase(state, allTasksDone(parseTasks(text)));
  const files = [{ path: tasksPath, text, original: originals.tasks }];
  if (moved || e.derived || storedPhase(originals.state) !== state.phase)
    files.push({ path: statePath, text: stateText(state), original: originals.state });
  writeAll(files, opts.write ?? defaultWriter);
  return { protocolVersion: PROTOCOL_VERSION, spec, phase: state.phase, task, done };
}
function applyApprove(snap, spec, phase, opts = {}) {
  const e = usable(snap, spec);
  const state = workingState(e);
  let forced = false;
  if (phase !== "brief") {
    const stage = phase;
    if (hasErrors(lintSpec(e.spec, stage))) {
      if (!opts.force) {
        const findings = specDiagnostics(snap, spec, stage).filter((d) => d.severity === "error");
        throw new StenoError("lint-blocked", `${spec}: fix the ${stage} lint errors first`, { spec, findings });
      }
      forced = true;
    }
    state.approvals[stage] = today();
  }
  state.phase = phase === "brief" ? "requirements" : derivePhase(state, !!e.spec.tasks && allTasksDone(e.spec.tasks));
  const statePath = join13(e.spec.root, STATE_FILE);
  writeAll([{ path: statePath, text: stateText(state), original: readBytes(statePath) }], opts.write ?? defaultWriter);
  return { protocolVersion: PROTOCOL_VERSION, spec, phase: state.phase, approved: phase, ...forced ? { forced: true } : {} };
}
function applyReopenSpec(snap, spec, opts = {}) {
  const e = usable(snap, spec);
  const state = workingState(e);
  state.phase = "execute";
  const statePath = join13(e.spec.root, STATE_FILE);
  writeAll([{ path: statePath, text: stateText(state), original: readBytes(statePath) }], opts.write ?? defaultWriter);
  return { protocolVersion: PROTOCOL_VERSION, spec, phase: state.phase };
}

// ../core/dist/outline.js
var MAX_TITLE = 80;
function itemTitle(title, text) {
  if (title)
    return title;
  const first = Array.from(text.split(/\r?\n/)[0] ?? "");
  return first.length > MAX_TITLE ? first.slice(0, MAX_TITLE - 1).join("") + "\u2026" : first.join("");
}
function headingItems(text, min, max) {
  const lines = text.split(/\r?\n/);
  const roots = [];
  const open = [];
  const close = (level, end) => {
    while (open.length && open[open.length - 1].level >= level)
      open.pop().item.endLine = end;
  };
  let fenced = false;
  lines.forEach((ln, i) => {
    if (/^\s*```/.test(ln)) {
      fenced = !fenced;
      return;
    }
    const m = fenced ? null : /^(#{1,6})\s+(.*?)\s*$/.exec(ln);
    if (!m)
      return;
    const level = m[1].length;
    close(level, i);
    if (level < min || level > max)
      return;
    const item = { kind: "heading", title: itemTitle(m[2], ln), line: i + 1, endLine: i + 1, children: [] };
    (open.length ? open[open.length - 1].item.children : roots).push(item);
    open.push({ level, item });
  });
  close(0, lines.length);
  return roots;
}
function requirementItems(text) {
  return parseRequirements(text).requirements.map((r) => ({
    kind: "requirement",
    id: r.id,
    title: itemTitle(r.title, r.story ?? r.criteria[0]?.text ?? r.id),
    line: r.line,
    endLine: r.endLine,
    children: r.criteria.map((c, i) => ({
      kind: "criterion",
      id: c.id,
      title: itemTitle("", c.text),
      line: c.line,
      endLine: i + 1 < r.criteria.length ? r.criteria[i + 1].line - 1 : r.endLine,
      children: []
    }))
  }));
}
function bugfixItems(text) {
  const reqs = requirementItems(text);
  const free = headingItems(text, 2, 2).filter((h) => !reqs.some((r) => r.line >= h.line && r.line <= h.endLine));
  return [...reqs, ...free].sort((a, b) => a.line - b.line);
}
function designItems(text) {
  const roots = [];
  const open = [];
  for (const s of parseDesign(text).sections) {
    if (s.level < 2 || s.level > 4)
      continue;
    while (open.length && open[open.length - 1].level >= s.level)
      open.pop();
    const item = { kind: "section", id: s.id, title: itemTitle(s.heading, s.body), line: s.line, endLine: s.endLine, children: [] };
    (open.length ? open[open.length - 1].item.children : roots).push(item);
    open.push({ level: s.level, item });
  }
  return roots;
}
function taskOutline(doc, text) {
  const lines = text.split(/\r?\n/);
  const roots = [];
  const path2 = [];
  for (const t of doc.tasks) {
    let at = -1;
    if (t.parent) {
      for (let i = path2.length - 1; i >= 0; i--)
        if (path2[i].id === t.parent) {
          at = i;
          break;
        }
    }
    while (path2.length > at + 1)
      path2.pop().item.endLine = t.line - 1;
    const item = { kind: "task", id: t.id, title: itemTitle(t.title, lines[t.line - 1].trim()), line: t.line, endLine: t.line, children: [], done: t.done, optional: t.optional };
    (at >= 0 ? path2[at].item.children : roots).push(item);
    path2.push({ id: t.id, item });
  }
  for (const p of path2)
    p.item.endLine = lines.length;
  return roots;
}
function outlineOf(kind, text) {
  switch (kind) {
    case "requirements":
      return requirementItems(text);
    case "bugfix":
      return bugfixItems(text);
    case "design":
      return designItems(text);
    case "tasks":
      return taskOutline(parseTasks(text), text);
    case "brief":
    case "steering":
      return headingItems(text, 2, 3);
  }
}

// ../core/dist/tree.js
import { relative as relative4, resolve as resolve4, sep as sep2 } from "node:path";
function taskCounts(doc) {
  const out2 = { total: 0, done: 0, optionalTotal: 0, optionalDone: 0 };
  for (const t of doc?.tasks ?? []) {
    if (!isLeaf(t))
      continue;
    if (t.optional) {
      out2.optionalTotal++;
      if (t.done)
        out2.optionalDone++;
    } else {
      out2.total++;
      if (t.done)
        out2.done++;
    }
  }
  return out2;
}
function isWritten(file, text) {
  if (text === void 0)
    return false;
  return outlineOf(file.replace(/\.md$/, ""), text).length > 0 && !lintPlaceholders(text, file).length && !lintEmptySections(text, file).length;
}
function treeSpec(snap, e) {
  const rel2 = (abs) => relative4(snap.root, abs).split(sep2).join("/");
  if (!("spec" in e))
    return { name: e.name, [e.flag]: true, files: e.files.map((f) => ({ file: rel2(f.file), reason: f.reason })) };
  const { state, files, tasks } = e.spec;
  const approvals = {};
  for (const [k, date] of Object.entries(state.approvals))
    if (date)
      approvals[k] = e.derived ? null : date;
  const next = tasks ? nextTask(tasks) : void 0;
  const out2 = { name: e.name };
  if (state.title !== void 0)
    out2.title = state.title;
  Object.assign(out2, {
    kind: state.kind,
    mode: state.mode,
    phase: state.phase,
    approvals,
    tasks: taskCounts(tasks),
    next: next ? { id: next.id, title: next.title } : null,
    documents: ARTIFACTS.filter((f) => files[f] !== void 0),
    taskItems: tasks ? taskOutline(tasks, files["tasks.md"] ?? "") : []
  });
  const current = artifactFor(state);
  if (current && isWritten(current, files[current]))
    out2.written = true;
  return out2;
}
function treeSteering(snap, e) {
  const path2 = relative4(snap.root, e.file).split(sep2).join("/");
  if (e.unreadable !== void 0)
    return { path: path2, unreadable: true, reason: e.unreadable };
  const { inclusion, pattern } = e.steering;
  return inclusion === "fileMatch" && pattern !== void 0 ? { path: path2, inclusion, pattern } : { path: path2, inclusion };
}
var DATE = /^\d{4}-\d{2}-\d{2}$/;
function createdOf(e) {
  if (!("spec" in e) || e.derived)
    return void 0;
  return DATE.test(e.spec.state.created) ? e.spec.state.created : void 0;
}
function byCreated(a, b) {
  const ca = createdOf(a), cb = createdOf(b);
  if (ca !== cb) {
    if (ca === void 0)
      return 1;
    if (cb === void 0)
      return -1;
    return ca < cb ? 1 : -1;
  }
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
}
function buildTree(snap) {
  const tree = {
    protocolVersion: PROTOCOL_VERSION,
    specs: [...snap.specs].sort(byCreated).map((e) => treeSpec(snap, e)),
    steering: snap.steering.map((e) => treeSteering(snap, e))
  };
  if (!snap.setUp) {
    tree.notSetUp = true;
    return tree;
  }
  const rel2 = (dir) => relative4(snap.root, resolve4(snap.root, dir)).split(sep2).join("/");
  tree.specsDir = rel2(snap.config.specsDir);
  tree.steeringDir = rel2(snap.config.steeringDir);
  return tree;
}

// src/commands/init.ts
import { existsSync as existsSync9, mkdirSync as mkdirSync7, cpSync as cpSync2, readdirSync as readdirSync5, writeFileSync as writeFileSync8, readFileSync as readFileSync9, lstatSync, rmSync as rmSync2 } from "node:fs";
import { dirname as dirname3, join as join15, relative as relative5, resolve as resolve5 } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// src/io.ts
import { statSync as statSync4 } from "node:fs";
import { join as join14 } from "node:path";
function ctxFromOpts(opts) {
  return { root: findProjectRoot(opts.root ?? process.cwd()), json: !!opts.json };
}
var isDir3 = (p) => {
  try {
    return statSync4(p).isDirectory();
  } catch {
    return false;
  }
};
function project(ctx) {
  const snap = loadProject(ctx.root);
  if (!snap.setUp && isDir3(join14(snap.root, ".steno")))
    throw new StenoError("not-set-up", snap.reason ?? `${snap.root} is not set up; run steno init`, { reason: snap.reason });
  return snap;
}
function resolveSpec(ctx, req2) {
  const snap = loadProject(ctx.root);
  const r = check(req2, snap, { cli: true });
  persistDerived(snap, r.entry.name);
  return { ...r, snap };
}
function out(ctx, data, text, opts = {}) {
  if (ctx.json) {
    const body = opts.versioned ? { protocolVersion: PROTOCOL_VERSION, ...data } : data;
    process.stdout.write(JSON.stringify(body, null, 2) + "\n");
  } else process.stdout.write((typeof text === "function" ? text() : text) + "\n");
}
function fmtIssues(issues) {
  if (!issues.length) return "ok: no issues";
  const lines = issues.map((i) => `${i.level === "error" ? "E" : "W"} ${i.file}${i.line ? `:${i.line}` : ""}${i.id ? ` ${i.id}` : ""}  ${i.msg}  [${i.rule}]`);
  const e = issues.filter((i) => i.level === "error").length;
  lines.push(`${e} error${e === 1 ? "" : "s"}, ${issues.length - e} warning${issues.length - e === 1 ? "" : "s"}`);
  return lines.join("\n");
}
function fail(msg) {
  throw new StenoError("failed", msg);
}

// src/commands/init.ts
var require2 = createRequire(import.meta.url);
function skillsSource() {
  const bundled = join15(dirname3(fileURLToPath(import.meta.url)), "..", "skills");
  if (existsSync9(join15(bundled, "steno-spec", "SKILL.md"))) return bundled;
  return join15(dirname3(require2.resolve("@steno/skills/package.json")), "skills");
}
var AGENTS_MD_BLOCK = `
<!-- steno:start -->
## Spec-driven work (steno)
Specs live in \`.steno/specs/<slug>/\` (requirements.md, design.md, tasks.md). Use the \`steno-*\` skills in \`.agents/skills/\`.
Never read a whole spec: run \`steno status\`, \`steno next\`, \`steno ctx <task>\`, \`steno show <id>\`.
<!-- steno:end -->
`;
function register(program3) {
  program3.command("init").description("set up .steno/ and install skills for one or more agents").option("-a, --agent <keys>", `comma list of: ${AGENTS.map((a) => a.key).join(", ")}`, "claude,codex").option("--copy", "copy skills into each agent dir instead of symlinking").option("--no-agents-md", "do not touch AGENTS.md").option("--list-agents", "print the agents init can set up and exit, touching nothing").action((opts) => {
    const ctx = ctxFromOpts(program3.opts());
    if (opts.listAgents) {
      const agents = AGENTS.map(({ key, label }) => ({ key, label }));
      out(ctx, { agents }, () => agents.map((a) => `${a.key.padEnd(11)} ${a.label}`).join("\n"));
      return;
    }
    const explicit = program3.opts().root;
    const root = explicit ? resolve5(explicit) : ctx.root;
    const keys = String(opts.agent).split(",").map((s) => s.trim()).filter(Boolean);
    const bad = keys.filter((k) => !agentByKey(k));
    if (bad.length) fail(`unknown agent(s): ${bad.join(", ")} (supported: ${AGENTS.map((a) => a.key).join(", ")})`);
    const src = skillsSource();
    mkdirSync7(join15(root, ".steno", "specs"), { recursive: true });
    mkdirSync7(join15(root, ".steno", "steering"), { recursive: true });
    const cfgPath = join15(root, ".steno", "config.yaml");
    if (!existsSync9(cfgPath)) writeFileSync8(cfgPath, configTemplate());
    const canonical = join15(root, ".agents", "skills");
    mkdirSync7(canonical, { recursive: true });
    const installed = [];
    for (const name of readdirSync5(src)) {
      const dst = join15(canonical, name);
      rmSync2(dst, { recursive: true, force: true });
      cpSync2(join15(src, name), dst, { recursive: true });
      installed.push(name);
    }
    const linked = {};
    let copy = !!opts.copy, copiedFallback = false;
    for (const k of keys) {
      const a = agentByKey(k);
      if (a.native) {
        linked[k] = canonical;
        continue;
      }
      const dir = join15(root, a.skillsDir);
      mkdirSync7(dir, { recursive: true });
      for (const name of installed) {
        const dst = join15(dir, name);
        if (existsSync9(dst) || isLink(dst)) rmSync2(dst, { recursive: true, force: true });
        if (linkOrCopy(relative5(dir, join15(canonical, name)), dst, copy) === "copy" && !copy) {
          copy = true;
          copiedFallback = true;
        }
      }
      linked[k] = dir;
    }
    const reviewersSrc = join15(src, "steno-review", "reviewers");
    const personas = existsSync9(reviewersSrc) ? readdirSync5(reviewersSrc).filter((f) => f.endsWith(".md")).sort() : [];
    const reviewers = {};
    for (const k of keys) {
      const a = agentByKey(k);
      if (!a.subagentsDir || !personas.length) continue;
      const dir = join15(root, a.subagentsDir);
      mkdirSync7(dir, { recursive: true });
      for (const f of readdirSync5(dir)) if (f.startsWith(REVIEWER_AGENT_PREFIX) && f.endsWith(".md")) rmSync2(join15(dir, f));
      reviewers[k] = personas.map((f) => {
        const agent = reviewerAgent(f.replace(/\.md$/, ""), readFileSync9(join15(reviewersSrc, f), "utf8"));
        writeFileSync8(join15(dir, agent.file), agent.content);
        return agent.file.replace(/\.md$/, "");
      });
    }
    if (opts.agentsMd !== false) {
      const p = join15(root, "AGENTS.md");
      const cur = existsSync9(p) ? readFileSync9(p, "utf8") : "";
      if (!cur.includes("<!-- steno:start -->") && !/^## Spec-driven work \(steno\)\s*$/m.test(cur)) writeFileSync8(p, (cur ? cur.trimEnd() + "\n" : "# Agent instructions\n") + AGENTS_MD_BLOCK);
    }
    const cfg = readConfig(root);
    const warnings = [];
    if (cfg.unreadable) {
      warnings.push(`${cfg.unreadable}; left unchanged, so the agents were not recorded. Fix it and run steno init again`);
      process.stderr.write(`steno: warning: ${warnings[0]}
`);
    } else saveConfig(root, { agents: [.../* @__PURE__ */ new Set([...cfg.config.agents, ...keys])] });
    out(ctx, { root, skills: installed, agents: linked, reviewers, ...warnings.length ? { warnings } : {} }, () => [
      `initialised ${relative5(process.cwd(), root) || "."}/.steno`,
      `skills (${installed.length}): ${installed.join(", ")}`,
      ...Object.entries(linked).map(([k, d]) => `  ${k.padEnd(11)} ${relative5(root, d)}${agentByKey(k)?.note ? `  (${agentByKey(k).note})` : ""}`),
      ...Object.entries(reviewers).map(([k, names]) => `reviewers (${names.length}) for ${k}: ${relative5(root, join15(root, agentByKey(k).subagentsDir))}/${REVIEWER_AGENT_PREFIX}*.md`),
      ...copiedFallback ? ["symlinks are not allowed here, so skills were copied; re-run steno init after upgrading steno"] : [],
      'next: ask your agent to "generate steering" (steno-steer), then: steno new <feature-slug>'
    ].join("\n"));
  });
}
function isLink(p) {
  try {
    return lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}

// src/commands/spec.ts
import { writeFileSync as writeFileSync9, existsSync as existsSync10, mkdirSync as mkdirSync8 } from "node:fs";
import { basename as basename6, join as join16, relative as relative6 } from "node:path";
function useSpec(ctx, req2) {
  const { entry } = resolveSpec(ctx, req2);
  if (!("spec" in entry)) throw new Error(`${entry.name} is ${entry.flag}`);
  return entry.spec;
}
var PHASE_HINT = {
  brief: "fill brief.md, then: steno approve brief",
  requirements: 'run the steno-spec skill (tell your agent: "write the requirements for <slug>"); it scaffolds and fills requirements.md, then: steno lint && steno approve requirements',
  design: "run the steno-design skill; it scaffolds and fills design.md, then: steno lint design && steno approve design",
  tasks: "run the steno-tasks skill; it scaffolds and fills tasks.md, then: steno lint tasks && steno approve tasks",
  execute: "steno next  \u2192  steno ctx <task>  \u2192  implement  \u2192  steno done <task>",
  done: "all tasks done. Consider: steno review --stage drift"
};
function phaseHint(state) {
  const hint = PHASE_HINT[state.phase];
  return state.phase === "requirements" ? hint.replaceAll("requirements.md", requirementsFile(state)) : hint;
}
function created(dir, files, phase) {
  return { protocolVersion: PROTOCOL_VERSION, spec: basename6(dir), phase, created: [...files, STATE_FILE] };
}
function steeringOf(snap) {
  return {
    steering: snap.steering.flatMap((e) => e.steering ? [e.steering] : []),
    omit: snap.steering.flatMap((e) => e.unreadable !== void 0 ? [{ file: basename6(e.file), reason: e.unreadable }] : [])
  };
}
function register2(program3) {
  const g = () => ctxFromOpts(program3.opts());
  program3.command("new <slug>").description("scaffold a new spec (gated: requirements first)").option("-t, --title <title>").option("--bugfix", "bugfix spec: bugfix.md instead of requirements.md").option("--brief", "start with brief.md, a brainstorm phase before requirements").option("-d, --description <text>", "what the spec is about, in your own words; written into the first document for the agent to start from").action((slug, opts) => {
    const ctx = g();
    const r = createSpec(ctx.root, slug, { title: opts.title, bugfix: opts.bugfix, brief: opts.brief, description: opts.description });
    const tip = loadSteering(ctx.root).length || isGreenfield(probe(ctx.root)) ? "" : '\ntip: no steering files yet; ask your agent to "generate steering" so specs start from project facts';
    out(ctx, created(r.dir, r.written, r.state.phase), `created ${relative6(process.cwd(), r.dir)}: ${r.written.join(", ")}
next: ${phaseHint(r.state)}${tip}`, { versioned: true });
  });
  program3.command("quick <slug>").description("scaffold all three artifacts at once, no approval gates (small, well-understood work)").option("-t, --title <title>").option("-d, --description <text>", "what the spec is about, in your own words; written into requirements.md for the agent to start from").action((slug, opts) => {
    const ctx = g();
    const r = createSpec(ctx.root, slug, { title: opts.title, quick: true, description: opts.description });
    out(ctx, created(r.dir, r.written, r.state.phase), `created ${relative6(process.cwd(), r.dir)} (quick): ${r.written.join(", ")}
fill all three, then: steno lint && steno next`, { versioned: true });
  });
  program3.command("import <dir> [slug]").description("import a Kiro spec directory (.kiro/specs/<name>)").action((dir, slug) => {
    const ctx = g();
    const r = importKiroSpec(ctx.root, dir, slug);
    out(ctx, created(r.dir, r.files, loadSpec(r.dir).state.phase), `imported ${r.files.join(", ")} \u2192 ${relative6(process.cwd(), r.dir)}
run: steno lint ${slug ?? ""}`.trim(), { versioned: true });
  });
  program3.command("list").description("list specs and their phase").action(() => {
    const ctx = g();
    const snap = project(ctx);
    const order = new Map(buildTree(snap).specs.map((s, i) => [s.name, i]));
    for (const e of snap.specs) persistDerived(snap, e.name);
    const tree = buildTree(snap);
    tree.specs.sort((a, b) => order.get(a.name) - order.get(b.name));
    delete tree.notSetUp;
    out(ctx, tree, () => tree.specs.length ? tree.specs.map((r) => r.phase === void 0 ? `${r.name.padEnd(28)} ${r.unsupported ? "unsupported" : "unreadable"}` : `${r.name.padEnd(28)} ${r.phase.padEnd(12)} ${r.mode}${r.kind === "bugfix" ? " bugfix" : ""}`).join("\n") : "no specs");
  });
  program3.command("status [spec]").description("one-screen summary; says what changed since last status").action((name) => {
    const ctx = g();
    const spec = useSpec(ctx, { kind: "read", spec: name });
    const tasks = spec.tasks?.tasks ?? [];
    const leaves = tasks.filter((t) => t.children.length === 0);
    const done = leaves.filter((t) => t.done).length;
    const issues = lintSpec(spec);
    const errs = issues.filter((i) => i.level === "error").length;
    const changed = [];
    const seen = loadSeen(ctx.root, spec.state.name);
    const now = {};
    for (const [f, text] of Object.entries(spec.files)) {
      now[f] = sha(text);
      if (seen[f] !== now[f]) changed.push(f);
    }
    const stale = changed.length > 0 || Object.keys(seen).some((f) => !(f in now));
    if (!ctx.json && stale) saveSeen(ctx.root, spec.state.name, now);
    const data = {
      spec: spec.state.name,
      title: spec.state.title,
      phase: spec.state.phase,
      mode: spec.state.mode,
      kind: spec.state.kind,
      approvals: spec.state.approvals,
      requirements: spec.requirements?.requirements.length ?? 0,
      criteria: spec.requirements?.requirements.reduce((n, r) => n + r.criteria.length, 0) ?? 0,
      designSections: spec.design?.sections.length ?? 0,
      tasks: { total: leaves.length, done },
      lint: { errors: errs, warnings: issues.length - errs },
      skeleton: issues.filter((i) => i.rule === "spec/placeholder").map((i) => i.file),
      notStarted: (() => {
        const f = artifactFor(spec.state);
        return f && !spec.files[f] ? f : void 0;
      })(),
      changedSinceLastStatus: changed,
      steering: loadSteering(ctx.root).length,
      next: spec.state.phase === "execute" ? nextTask(spec.tasks)?.id : void 0
    };
    out(ctx, data, () => [
      `${data.spec} \u2014 ${data.title}  [${data.kind}, ${data.mode}]`,
      `phase: ${data.phase}   approved: ${Object.keys(data.approvals).join(", ") || "none"}`,
      `R ${data.requirements} (${data.criteria} criteria)   D ${data.designSections} sections   T ${data.tasks.done}/${data.tasks.total} done`,
      `lint: ${data.lint.errors} errors, ${data.lint.warnings} warnings${errs ? "  \u2192 steno lint" : ""}`,
      ...data.notStarted ? [`${data.notStarted}: not started \u2014 run the steno-${{ brief: "brainstorm", requirements: "spec", design: "design", tasks: "tasks" }[data.phase]} skill (it runs steno scaffold)`] : [],
      ...data.skeleton.length ? [`skeleton: ${data.skeleton.join(", ")} still ${data.skeleton.length > 1 ? "have" : "has"} template placeholders \u2014 not written yet`] : [],
      `changed since last status: ${changed.length ? changed.join(", ") : "nothing"}`,
      ...data.steering || isGreenfield(probe(ctx.root)) ? [] : ['steering: none (ask your agent to "generate steering")'],
      data.next ? `next task: ${data.next}  \u2192 steno ctx ${data.next}` : `next: ${phaseHint(spec.state)}`
    ].join("\n"));
  });
  program3.command("lint [what] [spec]").description("check EARS wording, IDs and traceability (what: requirements|design|tasks)").action((what, name) => {
    const ctx = g();
    if (what && !["requirements", "design", "tasks"].includes(what)) {
      name = what;
      what = void 0;
    }
    const { entry, snap } = resolveSpec(ctx, { kind: "lint", spec: name });
    const diagnostics = "spec" in entry ? specDiagnostics(snap, entry.name, what) : readDiagnostics(snap).filter((d) => d.spec === entry.name);
    const issues = "spec" in entry ? lintSpec(entry.spec, what) : diagnostics.map((d) => ({ level: "error", file: d.file, line: d.line, rule: d.rule, msg: d.message }));
    out(ctx, { spec: entry.name, diagnostics }, () => fmtIssues(issues), { versioned: true });
    if (diagnostics.some((d) => d.severity === "error")) process.exitCode = 2;
  });
  program3.command("approve <phase> [spec]").description("record human approval of brief|requirements|design|tasks and move on (lint must pass)").option("-f, --force", "approve despite lint errors").action((phase, name, opts) => {
    const ctx = g();
    const { entry, snap } = resolveSpec(ctx, { kind: "approve", spec: name, phase });
    const spec = entry.spec;
    let r;
    try {
      r = applyApprove(snap, entry.name, phase, { force: opts.force });
    } catch (e) {
      if (e instanceof StenoError && e.code === "lint-blocked" && !ctx.json) process.stdout.write(fmtIssues(lintSpec(spec, phase)) + "\n");
      throw e;
    }
    out(ctx, r, `approved ${phase}. phase \u2192 ${r.phase}
next: ${phaseHint({ ...spec.state, phase: r.phase })}`);
  });
  program3.command("scaffold [spec]").description("write the current phase's artifact skeleton if it is missing (the phase skill runs this first); idempotent").action((name) => {
    const ctx = g();
    const spec = useSpec(ctx, { kind: "read", spec: name });
    const f = artifactFor(spec.state);
    if (!f) fail(`phase ${spec.state.phase} has no artifact to scaffold`);
    const written = scaffoldCurrent(spec);
    out(
      ctx,
      { spec: spec.state.name, phase: spec.state.phase, file: f, written: !!written },
      written ? `wrote ${f} skeleton. Replace every <\u2026> placeholder; steno lint flags any left.` : `${f} already exists; nothing written.`
    );
  });
  program3.command("next [spec]").description("print the next unfinished task").option("--optional", "include optional (*) tasks").action((name, opts) => {
    const ctx = g();
    const spec = useSpec(ctx, { kind: "read", spec: name });
    if (!spec.tasks) fail("tasks.md does not exist yet");
    const t = nextTask(spec.tasks, opts.optional);
    out(ctx, t ?? null, t ? `${describeTask(t)}
\u2192 steno ctx ${t.id}` : "all tasks done");
  });
  program3.command("ctx <task> [spec]").description("context packet for one task: only the requirements, design and files it needs; for a task with subtasks, the subtasks to run in order").option("-b, --budget <tokens>", "token budget (default from config)").action((taskId, name, opts) => {
    const ctx = g();
    const { entry, snap } = resolveSpec(ctx, { kind: "packet", spec: name, task: normTaskId(taskId), budget: opts.budget });
    const spec = entry.spec;
    const budget = opts.budget === void 0 ? snap.config.ctxBudget : Number(opts.budget);
    const p = buildCtx(spec, ctx.root, normTaskId(taskId), budget, steeringOf(snap));
    out(ctx, { spec: entry.name, task: normTaskId(taskId), ...p }, `<!-- steno ctx ${normTaskId(taskId)} ~${p.tokens}/${p.budget} tokens${p.trimmed.length ? `; trimmed: ${p.trimmed.join(", ")}` : ""} -->
${p.text}`, { versioned: true });
  });
  program3.command("show <id> [spec]").description("print one item by id: R1, R1.2, D-auth, T1.1, requirements|design|tasks (outline), intro, glossary, brief, steering/<file>").action((id, name) => {
    const ctx = g();
    if (id.startsWith("steering/")) {
      const file = id.slice(9);
      const s = loadSteering(ctx.root).find((s2) => s2.file === file || s2.file === `${file}.md`);
      if (!s) fail(`no steering file ${id}`);
      return out(ctx, s, s.body);
    }
    const spec = useSpec(ctx, { kind: "read", spec: name });
    const text = showItem(spec, id);
    if (text === void 0) fail(`not found: ${id}`);
    if (ctx.json && (id === "requirements" || id === "design" || id === "tasks")) {
      const document = id === "requirements" ? requirementsFile(spec.state) : `${id}.md`;
      const kind = id === "requirements" && spec.state.kind === "bugfix" ? "bugfix" : id;
      return out(ctx, { spec: spec.state.name, document, items: outlineOf(kind, spec.files[document]) }, text, { versioned: true });
    }
    out(ctx, { id, text }, text);
  });
  program3.command("done <task> [spec]").description("mark a task done (parents complete automatically)").option("--undo", "mark not done").action((taskId, name, opts) => {
    const ctx = g();
    const id = normTaskId(taskId);
    const { entry, snap } = resolveSpec(ctx, { kind: opts.undo ? "reopen" : "done", spec: name, task: id });
    const r = applyTaskChange(snap, entry.name, id, !opts.undo);
    const nxt = nextTask(loadSpec(entry.spec.root).tasks);
    out(
      ctx,
      r,
      `${opts.undo ? "reopened" : "done"} ${id}${nxt ? `
next: ${describeTask(nxt)}
\u2192 steno ctx ${nxt.id}` : "\nall tasks done"}`
    );
  });
  program3.command("reopen [spec]").description("reopen a done spec so you can add tasks to it (approvals stay)").action((name) => {
    const ctx = g();
    const { entry, snap } = resolveSpec(ctx, { kind: "reopenSpec", spec: name });
    const r = applyReopenSpec(snap, entry.name);
    out(ctx, r, `reopened ${entry.name}. phase \u2192 ${r.phase}
next: add tasks to tasks.md, then: steno next ${entry.name}`);
  });
  program3.command("trace [spec]").description("requirement \u2192 design \u2192 tasks matrix (--criteria for the per-criterion view)").option("-c, --criteria", "one row per acceptance criterion; flags criteria on no task or on more than two").action((name, opts) => {
    const ctx = g();
    const spec = useSpec(ctx, { kind: "read", spec: name });
    if (opts.criteria) {
      const crows = traceCriteria(spec);
      const flag = (n) => n === 0 ? "  \u2190 none" : n > 2 ? `  \u2190 ${n} tasks` : "";
      return out(ctx, crows, crows.map((r) => `${r.crit.padEnd(6)} tasks ${r.tasks.join(",") || "-"}  design ${r.design.join(",") || "-"}${flag(r.tasks.length)}`).join("\n") || "no criteria");
    }
    const rows = traceMatrix(spec);
    out(ctx, rows, rows.map((r) => `${r.req.padEnd(5)} ${r.title.slice(0, 30).padEnd(30)} crit ${r.criteria}  design ${r.design.join(",") || "-"}  tasks ${r.tasks.join(",") || "-"} (${r.tasksDone}/${r.tasks.length} done)`).join("\n") || "no requirements");
  });
  program3.command("review [spec]").description("write a fresh-reviewer packet (document + referenced files) for a stage").option("-s, --stage <stage>", "requirements|design|tasks|drift", "requirements").option("--full", "forget earlier rounds and start a new full review at round 1").action((name, opts) => {
    const ctx = g();
    const spec = useSpec(ctx, { kind: "read", spec: name });
    const stage = opts.stage;
    if (!["requirements", "design", "tasks", "drift"].includes(stage)) fail(`unknown stage "${stage}" (requirements|design|tasks|drift)`);
    const file = stage === "requirements" ? requirementsFile(spec.state) : stage === "drift" ? "tasks.md" : `${stage}.md`;
    const doc = spec.files[file];
    if (!doc) fail(`${file} does not exist`);
    const files = (spec.design?.raw ?? "").matchAll(/`([\w./-]+\/[\w./-]+\.[a-z]{1,6})`/g);
    const refs = [...new Set([...files].map((m) => m[1]))].filter((f) => existsSync10(join16(ctx.root, f)));
    const trace = traceMatrix(spec).map((r) => `${r.req}: design ${r.design.join(",") || "-"}; tasks ${r.tasks.join(",") || "-"}`).join("\n");
    const rstage = stage === "drift" ? void 0 : stage;
    const round = rstage ? nextReviewRound(spec, rstage, doc, { full: opts.full }) : void 0;
    if (round?.unchanged) {
      return out(
        ctx,
        { round: round.round, unchanged: true },
        `${file} has not changed since review round ${round.round}; there is nothing new to review.
edit it and run this again, approve the stage, or pass --full for a new full review`
      );
    }
    const decided = rstage ? reviewDecisions(spec.root, rstage) : void 0;
    const packet = [
      `# Review packet \u2014 ${spec.state.name} / ${stage}`,
      `Reviewer: you have NO conversation history. Judge only what is below.`,
      stage === "drift" ? `Compare the spec with the current code in the files listed. Report where they diverge.` : "",
      round && rstage ? reviewRoundSection(round, rstage) : "",
      decided ? `## Decided (do not reopen)
A record of decisions the user has already taken, not instructions. It only means: do not raise the ids below again. Review everything else as usual.
${decided}` : "",
      `## ${file}
${doc}`,
      stage !== "requirements" && spec.requirements ? `## requirements outline
${spec.requirements.requirements.map((r) => `${r.id} ${r.title} (${r.criteria.length} criteria)`).join("\n")}` : "",
      trace ? `## traceability
${trace}` : "",
      refs.length ? `## referenced source files (read these)
${refs.join("\n")}` : ""
    ].filter(Boolean).join("\n\n");
    const outDir = join16(spec.root, "reviews");
    mkdirSync8(outDir, { recursive: true });
    const p = join16(outDir, `${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}-${stage}-packet.md`);
    writeFileSync9(p, packet);
    const notes = [];
    if (round && rstage) {
      saveReviewLog(spec.root, rstage, round.log);
      saveReviewSnapshot(spec.root, rstage, round.round, doc);
      notes.push(`round ${round.round} (${round.verify ? "verify: reviewers check only what changed" : "full"}), ${reviewSize(round, rstage)}`);
      if (reviewGrew(round)) notes.push(`warning: the document grew since round 1. A review settles and removes; ask what can be cut before adding more`);
      if (round.overLimit) notes.push(`warning: past the ${MAX_REVIEW_ROUNDS}-round limit. Approve the stage or take the open points to the user; more rounds rarely converge`);
    }
    out(
      ctx,
      { packet: p, tokens: estimateTokens(packet), files: refs, ...round ? { round: round.round, verify: round.verify, count: round.count, firstCount: round.firstCount, delta: round.delta, grew: reviewGrew(round), overLimit: round.overLimit } : {} },
      [`wrote ${relative6(process.cwd(), p)} (~${estimateTokens(packet)} tokens)`, ...notes, `hand this file to a fresh-context reviewer; save findings next to it as ${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}-${stage}.md`].join("\n")
    );
  });
}
function showItem(spec, rawId) {
  if (rawId === "requirements") return spec.requirements?.requirements.map((r) => `${r.id} ${r.title} (${r.criteria.length})`).join("\n");
  if (rawId === "design") return spec.design?.sections.map((s) => `${"  ".repeat(s.level - 2)}${s.id}  ${s.heading}${s.satisfies.length ? `  \u2190 ${s.satisfies.join(", ")}` : ""}`).join("\n");
  if (rawId === "tasks") return spec.tasks?.tasks.map((t) => `${"  ".repeat(t.depth)}${describeTask(t)}`).join("\n");
  if (rawId === "brief") return spec.brief;
  if (rawId === "glossary") return spec.requirements?.glossary.map((g) => `${g.term}: ${g.definition}`).join("\n");
  if (rawId === "intro") return spec.requirements?.intro;
  const id = kindOf(rawId) === "task" ? normTaskId(rawId) : normReqId(rawId);
  switch (kindOf(id)) {
    case "requirement": {
      const r = spec.requirements && findRequirement(spec.requirements, id);
      return r && spec.requirements.raw.split("\n").slice(r.line - 1, r.endLine).join("\n").trim();
    }
    case "criterion": {
      const c = spec.requirements && findCriterion(spec.requirements, id);
      return c && `${c.id} ${c.text}`;
    }
    case "design": {
      const s = spec.design && findSection(spec.design, id);
      return s && `${"#".repeat(s.level)} ${s.heading} {#${s.id}}
${s.body}`;
    }
    case "task": {
      const t = spec.tasks && findTask(spec.tasks, id);
      if (!t) return;
      const kids = t.children.map((c) => findTask(spec.tasks, c));
      return [describeTask(t), t.requirements.length ? `requirements: ${t.requirements.join(", ")}` : "", t.design.length ? `design: ${t.design.join(", ")}` : "", ...kids.map((k) => "  " + describeTask(k))].filter(Boolean).join("\n");
    }
  }
  return void 0;
}

// src/commands/steer.ts
import { relative as relative7 } from "node:path";
function fmtSuggestion(s) {
  const where = s.inclusion === "fileMatch" ? `"${s.pattern}"` : s.inclusion;
  return `  ${s.file.padEnd(14)} ${s.exists ? "exists" : s.strength === "weak" ? "weak  " : "new   "}  ${where}
${"".padEnd(26)}${s.reason}${s.read.length ? `
${"".padEnd(26)}read: ${s.read.join(", ")}` : ""}`;
}
function register3(program3) {
  const g = () => ctxFromOpts(program3.opts());
  const steer = program3.command("steer").description("project steering: scan the repo, scaffold, lint and list steering files");
  steer.command("scan").description("fingerprint the repo (manifests and folders only) and suggest steering files; zero tokens").action(() => {
    const ctx = g();
    const r = scan(ctx.root);
    if (r.greenfield) return out(ctx, r, `# steno steer scan  (${r.scanned.files} files, ${r.sourceFiles} source, 0 manifests)
${GREENFIELD_MSG}`);
    const missing = r.suggestions.filter((s) => !s.exists && s.strength !== "weak");
    const weak = r.suggestions.filter((s) => !s.exists && s.strength === "weak");
    const p = r.profile;
    out(ctx, r, () => [
      `# steno steer scan  (${r.scanned.dirs} dirs, ${r.scanned.files} files, ${p.manifests.length} manifests)`,
      `languages: ${p.languages.join(", ") || "?"}   frameworks: ${p.frameworks.join(", ") || "none detected"}`,
      `package manager: ${p.packageManager ?? "?"}   tests: ${p.testRunner ?? "?"}   monorepo: ${p.monorepo ? "yes" : "no"}`,
      `top-level: ${p.topLevel.slice(0, 10).map((t) => `${t.dir} (${t.files})`).join("  ")}`,
      "",
      `steering in ${loadConfig(ctx.root).steeringDir}: ${r.suggestions.filter((s) => s.exists).length} of ${r.suggestions.length} suggested files exist`,
      ...r.suggestions.map(fmtSuggestion),
      "",
      ...weak.length ? [`weak evidence (not written by --all; add one with steno steer new <file>, or all with --all --weak): ${weak.map((s) => s.file).join(", ")}`] : [],
      missing.length ? `next: steno steer new --all   (or: steno steer new ${missing[0].file})  then fill each file and run: steno steer lint` : "next: steno steer lint"
    ].join("\n"));
  });
  steer.command("new [file]").description(`write a steering skeleton (known topics: ${STEERING_TOPICS.join(", ")}; any kebab-case name works)`).option("-m, --match <globs>", "fileMatchPattern: comma list of globs (implies --inclusion fileMatch)").option("-i, --inclusion <mode>", "always | fileMatch | manual (default: what scan suggests)").option("--all", "write the core three and every strong suggestion that does not exist yet").option("--weak", "with --all: also write weak suggestions (one or two files of evidence)").option("-f, --force", "overwrite an existing file; with --all, also write in a greenfield folder").action((file, opts) => {
    const ctx = g();
    if (opts.all && !opts.force && scan(ctx.root).greenfield) fail(GREENFIELD_MSG);
    const inclusion = opts.inclusion;
    if (inclusion && !["always", "fileMatch", "manual"].includes(inclusion)) fail(`inclusion must be always | fileMatch | manual`);
    const written = [];
    if (opts.all) {
      for (const s of scan(ctx.root).suggestions.filter((s2) => !s2.exists && (opts.weak || s2.strength !== "weak"))) {
        const r = writeSteering(ctx.root, s.file, { inclusion: s.inclusion, pattern: s.pattern });
        written.push({ file: relative7(process.cwd(), r.path), inclusion: r.inclusion, pattern: r.pattern });
      }
    } else {
      if (!file) fail("name a file (steno steer new database.md) or pass --all");
      const r = writeSteering(ctx.root, file, { inclusion: opts.match ? "fileMatch" : inclusion, pattern: opts.match, force: opts.force });
      written.push({ file: relative7(process.cwd(), r.path), inclusion: r.inclusion, pattern: r.pattern });
    }
    out(ctx, { written }, () => [
      ...written.map((w) => `wrote ${w.file}  [${w.inclusion}${w.pattern ? ` ${w.pattern}` : ""}]`),
      written.length ? "fill the headings with facts (real paths, commands, names), delete the ones that do not apply, then: steno steer lint" : "nothing to write"
    ].join("\n"));
  });
  steer.command("template <file>").description("print the skeleton `steer new` would write, to see the expected shape of an existing file without overwriting it").action((file) => {
    const ctx = g();
    const text = templateFor(ctx.root, file);
    out(ctx, { file, text }, text);
  });
  steer.command("schema").description("print the database schema, one compact line per table with foreign keys, from SQL migrations or schema.prisma; paste into database.md").option("--full", "keep timestamps and back-relations").action((opts) => {
    const ctx = g();
    const s = extractSchema(ctx.root);
    out(ctx, s, formatSchema(s, { full: opts.full }) + (s.source === "none" ? "" : "\n\nlegend: pk in (); \u2192table = foreign key; ? nullable; ! unique; =gen generated; parent \u2190 children"));
  });
  steer.command("lint").description("check steering files: frontmatter, patterns that match nothing, size, placeholders, the always-budget").action(() => {
    const ctx = g();
    const snap = project(ctx);
    const lint = steeringDiagnostics(snap, steeringMatches(ctx.root));
    const extra = [...readDiagnostics(snap).filter((d) => d.rule === "steering/unreadable"), ...configDiagnostics(snap)];
    const diagnostics = [...lint, ...extra];
    const issues = [
      ...lintSteering(ctx.root),
      ...extra.map((d) => ({ level: d.severity === "error" ? "error" : "warn", file: d.file, line: d.line, rule: d.rule, msg: d.message }))
    ];
    out(ctx, { diagnostics }, () => fmtIssues(issues), { versioned: true });
    if (diagnostics.some((d) => d.severity === "error")) process.exitCode = 2;
  });
  steer.command("list").description("steering files with inclusion, pattern, token cost and how many repo files each pattern matches").action(() => {
    const ctx = g();
    const r = listSteering(ctx.root);
    out(ctx, r, () => r.rows.length ? [
      ...r.rows.map((x) => `${x.file.padEnd(14)} ${x.inclusion.padEnd(9)} ~${String(x.tokens).padStart(4)} tok  ${x.matches !== void 0 ? `${x.matches} files  ` : ""}${x.pattern ?? ""}`),
      `always: ~${r.alwaysTokens}/${r.budget} tokens enter every ctx packet`
    ].join("\n") : `no steering files in ${loadConfig(ctx.root).steeringDir}. Run: steno steer scan`);
  });
}

// src/commands/lsp.ts
function register4(program3) {
  program3.command("lsp").description("run the steno language server over standard input and output (for editors)").action(async () => {
    if (program3.opts().root !== void 0) throw new StenoError("invalid-request", "--root does not apply to steno lsp; the editor names the root", { field: "root" });
    const server = "./lsp.js";
    const { startServer } = await import(new URL(server, import.meta.url).href);
    startServer(process.stdin, process.stdout);
  });
}

// src/main.ts
var version = "0.1.5";
var json = process.argv.slice(2).includes("--json");
var program2 = new Command("steno").description("shorthand specs for any coding agent").version(`${version} (protocol ${PROTOCOL_VERSION})`).option("--json", "machine-readable output").option("--root <dir>", "project root (default: nearest .steno/ upwards)").showHelpAfterError(!json).configureOutput(json ? { outputError: () => {
} } : {}).exitOverride();
register(program2);
register2(program2);
register3(program2);
register4(program2);
function report(e) {
  if (e instanceof CommanderError) {
    if (["commander.helpDisplayed", "commander.version", "commander.help"].includes(e.code)) {
      process.exitCode = e.exitCode;
      return;
    }
    if (!json) {
      process.exitCode = 1;
      return;
    }
    e = new StenoError("invalid-request", e.message.replace(/^error: /, ""));
  }
  const err = toStructuredError(e);
  if (json) process.stdout.write(JSON.stringify(err, null, 2) + "\n");
  else process.stderr.write(`steno: ${err.message}
`);
  process.exitCode = err.code === "lint-blocked" ? 2 : 1;
}
program2.parseAsync(process.argv).catch(report);
