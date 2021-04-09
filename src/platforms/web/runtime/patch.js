/* @flow */

import * as nodeOps from "web/runtime/node-ops";
import { createPatchFunction } from "core/vdom/patch";
//! 指令和 ref 相关的 module
import baseModules from "core/vdom/modules/index";
//! 和平台相关的modules
//! attrs,
//! klass,
//! events,
//! domProps,
//! style,
//! transition
import platformModules from "web/runtime/modules/index";

// the directive module should be applied last, after all
// built-in modules have been applied.
const modules = platformModules.concat(baseModules);
//! nodeOps dom 操作相关 api
//! modules
export const patch: Function = createPatchFunction({ nodeOps, modules });
