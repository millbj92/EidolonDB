// @ts-nocheck
import { default as __fd_glob_15 } from "../content/docs/capabilities/meta.json?collection=meta"
import { default as __fd_glob_14 } from "../content/docs/eidolondb/meta.json?collection=meta"
import { default as __fd_glob_13 } from "../content/docs/getting-started/meta.json?collection=meta"
import { default as __fd_glob_12 } from "../content/docs/meta.json?collection=meta"
import * as __fd_glob_11 from "../content/docs/capabilities/secrets.mdx?collection=docs"
import * as __fd_glob_10 from "../content/docs/capabilities/quickstart.mdx?collection=docs"
import * as __fd_glob_9 from "../content/docs/capabilities/policy-engine.mdx?collection=docs"
import * as __fd_glob_8 from "../content/docs/capabilities/memory-aware-policy.mdx?collection=docs"
import * as __fd_glob_7 from "../content/docs/capabilities/concepts.mdx?collection=docs"
import * as __fd_glob_6 from "../content/docs/capabilities/cli-reference.mdx?collection=docs"
import * as __fd_glob_5 from "../content/docs/capabilities/capability-yaml.mdx?collection=docs"
import * as __fd_glob_4 from "../content/docs/capabilities/approvals.mdx?collection=docs"
import * as __fd_glob_3 from "../content/docs/getting-started/introduction.mdx?collection=docs"
import * as __fd_glob_2 from "../content/docs/eidolondb/quickstart.mdx?collection=docs"
import * as __fd_glob_1 from "../content/docs/eidolondb/concepts.mdx?collection=docs"
import * as __fd_glob_0 from "../content/docs/eidolondb/api-reference.mdx?collection=docs"
import { server } from 'fumadocs-mdx/runtime/server';
import type * as Config from '../source.config';

const create = server<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>({"doc":{"passthroughs":["extractedReferences"]}});

export const docs = await create.doc("docs", "content/docs", {"eidolondb/api-reference.mdx": __fd_glob_0, "eidolondb/concepts.mdx": __fd_glob_1, "eidolondb/quickstart.mdx": __fd_glob_2, "getting-started/introduction.mdx": __fd_glob_3, "capabilities/approvals.mdx": __fd_glob_4, "capabilities/capability-yaml.mdx": __fd_glob_5, "capabilities/cli-reference.mdx": __fd_glob_6, "capabilities/concepts.mdx": __fd_glob_7, "capabilities/memory-aware-policy.mdx": __fd_glob_8, "capabilities/policy-engine.mdx": __fd_glob_9, "capabilities/quickstart.mdx": __fd_glob_10, "capabilities/secrets.mdx": __fd_glob_11, });

export const meta = await create.meta("meta", "content/docs", {"meta.json": __fd_glob_12, "getting-started/meta.json": __fd_glob_13, "eidolondb/meta.json": __fd_glob_14, "capabilities/meta.json": __fd_glob_15, });