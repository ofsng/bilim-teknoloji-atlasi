"""Bilgi tabanının kendi aracıyla (tools/kb.py) referans döküm üretir; testler atlas verisini bununla karşılaştırır.
Kullanım: python3 tests/kb_reference.py <bilgi-tabanı-klasörü>"""
import json
import os
import sys

root = os.path.abspath(sys.argv[1])
sys.path.insert(0, os.path.join(root, "tools"))
import kb  # noqa: E402

kb.set_root(root)
tree = kb.Tree()
stats = kb.compute_stats(tree)
out = {
    "top": tree.top,
    "nodes": {
        nid: {
            "parent": n["parent_id"],
            "dir": n["dir"].replace(os.sep, "/"),
            "depth": n["depth"],
            "children": n["children"],
            "research": [r["path"].replace(os.sep, "/") for r in n["research"]],
            "related": n["meta"].get("related") or [],
            "depends_on": n["meta"].get("depends_on") or [],
            "applied_in": n["meta"].get("applied_in") or [],
        }
        for nid, n in tree.nodes.items()
    },
    "research": {r["path"].replace(os.sep, "/"): {"tech": r["tech"], "research_id": r["meta"].get("research_id")} for r in tree.research},
    "stats": {k: stats[k] for k in ("disciplines", "nodes", "leaves", "max_depth", "research", "relations")},
    "dup_ids": tree.dup_ids,
    "orphans": tree.orphans,
}
json.dump(out, sys.stdout, ensure_ascii=False)
