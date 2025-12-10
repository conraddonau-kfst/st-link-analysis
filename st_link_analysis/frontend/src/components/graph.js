import cytoscape from "cytoscape";
import fcose from "cytoscape-fcose";
import cola from "cytoscape-cola";
import dagre from "cytoscape-dagre";
import State from "../utils/state";
import { debounce, getCyInstance, debouncedSetValue } from "../utils/helpers";
import STYLES from "../utils/styles";

// Register cytoscape extensions
cytoscape.use(fcose);
cytoscape.use(cola);
cytoscape.use(dagre);

// Constants & configurations
const CY_ID = "cy";
const SELECT_DEBOUNCE = 100;

// Props from Python wrapper
// These should be passed automatically via Streamlit component props
const visible_node_data_keys = window.props?.visible_node_data_keys || null;
const visible_edge_data_keys = window.props?.visible_edge_data_keys || null;


// Event hanlders
function _handleSelection(e) {
    const selection = { selected: null, lastSelected: null };
    const type = e.type;

    if (type === "select") {
        let data = e.target.data(); // full element data
        const isEdge = e.target.group() === "edges";

        // choose allowed keys based on node/edge
        const allowedKeys = isEdge ? visible_edge_data_keys : visible_node_data_keys;

        // filter data if a whitelist is provided
        if (allowedKeys && allowedKeys.length > 0) {
            const filteredData = {};
            allowedKeys.forEach((key) => {
                if (key in data) filteredData[key] = data[key];
            });
            data = filteredData;
        }

        // store filtered data in lastSelected
        selection.lastSelected = { element: e.target, data };
    }

    // always store the full selection collection
    selection.selected = e.cy.$(":selected");
    State.updateState("selection", selection);

    document.body.focus();
}


// Initailize cytoscape (only runs once)
function initCyto(listeners) {
    const cy = cytoscape({ container: document.getElementById(CY_ID) });
    cy.on("select unselect", debounce(_handleSelection, SELECT_DEBOUNCE));
    listeners.forEach((L) => {
        cy.on(
            L.event_type,
            L.selector,
            (e) => {
                debouncedSetValue({
                    action: L.name,
                    data: {
                        type: e.type,
                        target_id: e.target.id(),
                        target_group: e.target.group(),
                    },
                    timestamp: Date.now(),
                });
            },
            Math.max(L.debounce, 100)
        );
    });
    return cy;
}

// Callbacks for state changes
const graph = {
    updateHighlight: function () {
        const cy = getCyInstance();
        const el = State.getState("selection").lastSelected;
        cy.$(".highlight").removeClass("highlight");
        const g = el?.group();
        if (g == "nodes") {
            el.connectedEdges().addClass("highlight");
        } else if (g == "edges") {
            el.connectedNodes().addClass("highlight");
        }
    },
    updateLayout: function () {
        const cy = getCyInstance();
        cy.layout(State.getState("layout")).run();
    },
    updateStyle: function () {
        const cy = getCyInstance();
        const { theme, custom_style } = State.getState("style");
        const style = [
            ...STYLES[theme]["default"],
            ...custom_style,
            ...STYLES[theme]["highlight"],
        ];
        document.body.setAttribute("data-theme", theme);
        cy.style(style);
    },
};

export default initCyto;
export { graph };
