// @ts-nocheck
import { browser } from 'fumadocs-mdx/runtime/browser';
import type * as Config from '../source.config';

const create = browser<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>();
const browserCollections = {
  docs: create.doc("docs", {"eidolondb/api-reference.mdx": () => import("../content/docs/eidolondb/api-reference.mdx?collection=docs"), "eidolondb/concepts.mdx": () => import("../content/docs/eidolondb/concepts.mdx?collection=docs"), "eidolondb/quickstart.mdx": () => import("../content/docs/eidolondb/quickstart.mdx?collection=docs"), "getting-started/introduction.mdx": () => import("../content/docs/getting-started/introduction.mdx?collection=docs"), "capabilities/approvals.mdx": () => import("../content/docs/capabilities/approvals.mdx?collection=docs"), "capabilities/capability-yaml.mdx": () => import("../content/docs/capabilities/capability-yaml.mdx?collection=docs"), "capabilities/cli-reference.mdx": () => import("../content/docs/capabilities/cli-reference.mdx?collection=docs"), "capabilities/concepts.mdx": () => import("../content/docs/capabilities/concepts.mdx?collection=docs"), "capabilities/memory-aware-policy.mdx": () => import("../content/docs/capabilities/memory-aware-policy.mdx?collection=docs"), "capabilities/policy-engine.mdx": () => import("../content/docs/capabilities/policy-engine.mdx?collection=docs"), "capabilities/quickstart.mdx": () => import("../content/docs/capabilities/quickstart.mdx?collection=docs"), "capabilities/secrets.mdx": () => import("../content/docs/capabilities/secrets.mdx?collection=docs"), }),
};
export default browserCollections;