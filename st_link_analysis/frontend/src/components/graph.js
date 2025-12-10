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

// Helper to get visible properties for an element based on its label
function _getVisibleProperties(element) {
    const isEdge = element.group() === "edges";
    const elementLabel = element.data("label");

    // Get per-style visible properties maps from props
    const nodeVisibleProps = window.props?.node_visible_props || {};
    const edgeVisibleProps = window.props?.edge_visible_props || {};

    // Fallback to deprecated global keys for backward compatibility
    const globalNodeKeys = window.props?.visible_node_data_keys || null;
    const globalEdgeKeys = window.props?.visible_edge_data_keys || null;

    // Determine allowed keys: per-style takes priority, then global, then null (show all)
    let allowedKeys;
    if (isEdge) {
        allowedKeys =
            edgeVisibleProps[elementLabel] !== undefined
                ? edgeVisibleProps[elementLabel]
                : globalEdgeKeys;
    } else {
        allowedKeys =
            nodeVisibleProps[elementLabel] !== undefined
                ? nodeVisibleProps[elementLabel]
                : globalNodeKeys;
    }

    return allowedKeys;
}

// Event hanlders
function _handleSelection(e) {
    const selection = { selected: null, lastSelected: null };
    const type = e.type;

    if (type === "select") {
        const element = e.target;

        // Get visible properties based on element's label
        const allowedKeys = _getVisibleProperties(element);

        // filter element data
        const filteredData =
            allowedKeys && allowedKeys.length > 0
                ? allowedKeys.reduce((acc, key) => {
                      if (key in element.data()) acc[key] = element.data()[key];
                      return acc;
                  }, {})
                : element.data();

        // store the element and filtered data
        selection.lastSelected = {
            element,
            filteredData, // <--- this is what the panel will read
        };
    }

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
