function pairsFromNodes(nodes) {
    const seen = {};
    const pairs = [];
    (nodes || []).forEach(function (node) {
        (node.nodeIds || []).forEach(function (otherId) {
            if (!otherId || otherId === node.id) {
                return;
            }
            const a = node.id;
            const b = otherId;
            const key = a < b ? a + "|" + b : b + "|" + a;
            if (!seen[key]) {
                seen[key] = true;
                pairs.push([a, b]);
            }
        });
    });
    return pairs;
}

export function graphDataFromNodes(sourceNodes) {
    const nodes = (sourceNodes || []).map(function (node) {
        const data = node.data || {};
        const item = {
            id: node.id,
            name: data.title || node.id,
            data: data,
        };
        const pos = node.position;
        if (
            pos &&
            typeof pos.x === "number" &&
            typeof pos.y === "number" &&
            typeof pos.z === "number" &&
            isFinite(pos.x) &&
            isFinite(pos.y) &&
            isFinite(pos.z)
        ) {
            item.fx = pos.x;
            item.fy = pos.y;
            item.fz = pos.z;
        } else {
            item.fz = 0;
        }
        return item;
    });
    const links = pairsFromNodes(sourceNodes).map(function (pair) {
        return { source: pair[0], target: pair[1] };
    });
    return { nodes: nodes, links: links };
}
