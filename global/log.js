function show_log_button(id)
{
    // find the node on the canvas
    const node_svg = document.getElementById(id);
    if (!node_svg) return;

    remove_log_button(id);

    const btn = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    btn.setAttribute("class", "red-ui-flow-node-button-background");
    btn.setAttribute("x", 0);
    btn.setAttribute("y", -20);
    btn.setAttribute("width", 60);
    btn.setAttribute("height", 25);
    btn.setAttribute("rx", 5);
    btn.setAttribute("ry", 5);

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("class", "red-ui-flow-node-status-label");
    text.setAttribute("x", 30);
    text.setAttribute("y", -10);
    text.style.setProperty("text-anchor", "middle");
    text.style.setProperty("alignment-baseline", "middle");
    text.setAttribute("font-size", "12");
    text.textContent = "Show log";

    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.setAttribute("id", "node_" + id + "_log_button")

    group.addEventListener("click", () => 
    {
        remove_log_button(id);
        show_log_window(id);
    });

    group.appendChild(btn);
    group.appendChild(text);

    node_svg.insertBefore(group, node_svg.firstChild);
}

function remove_log_button(id)
{
    const old = document.getElementById("node_" + id + "_log_button");
    if (old) old.remove();
}

function show_log_window(id)
{
    // find the node on the canvas
    const node_svg = document.getElementById(id);
    if (!node_svg) return;

    remove_log_window(id);

    // svg object for holding html
    const foreign_object = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
    foreign_object.setAttribute("id", "node_" + id + "_log_window");
    foreign_object.setAttribute("class", "red-ui-flow-node-button-background");
    foreign_object.setAttribute("x", 0);
    foreign_object.setAttribute("y", -99);
    foreign_object.setAttribute("width", 300);
    foreign_object.setAttribute("height", 100);

    // foreign_object can contain only one element
    const div = document.createElement("div");
    div.style.width = "100%";
    div.style.height = "100%";
    div.style.display = "flex";
    div.style.flexDirection = "column";
    div.style.justifyContent = "space-between";

    // close button 
    const close_btn = document.createElement("button");
    close_btn.style.width = "20px";
    close_btn.style.height = "20px";
    close_btn.style.position = "absolute";
    close_btn.style.top = "0";
    close_btn.style.right = "0";

    close_btn.style.border = "1px solid black"
    close_btn.style.borderRadius = "5px";
    close_btn.style.backgroundColor = "#FFFFFF";
    // close_btn.style.transition = "background 0.2s";
    // close_btn.onmouseover = () => height_btn.style.backgroundColor = "#AAAAAA";
    // close_btn.onmouseout = () => height_btn.style.backgroundColor = "#FFFFFF";

    close_btn.style.display = "flex";
    close_btn.style.alignItems = "center";
    close_btn.style.justifyContent = "center";
    const close_icon = document.createElement("i");
    close_icon.className = "fa fa-times";
    close_btn.appendChild(close_icon);

    close_btn.addEventListener("click", e => 
    {
        remove_log_window(id);
        show_log_button(id);
    });

    // height resize dragable button
    const height_btn = document.createElement("div");
    height_btn.style.width = "30px";
    height_btn.style.height = "18px";
    height_btn.style.position = "absolute";
    height_btn.style.top = "0";
    height_btn.style.left = "50%";
    height_btn.style.transform = "translateX(-50%)";
    height_btn.style.cursor = "ns-resize";

    height_btn.style.border = "1px solid black"
    height_btn.style.borderRadius = "5px";
    height_btn.style.backgroundColor = "#FFFFFF";
    height_btn.style.transition = "background 0.2s";
    height_btn.onmouseover = () => height_btn.style.backgroundColor = "#AAAAAA";
    height_btn.onmouseout = () => height_btn.style.backgroundColor = "#FFFFFF";

    height_btn.style.display = "flex";
    height_btn.style.alignItems = "center";
    height_btn.style.justifyContent = "center";
    const height_icon = document.createElement("i");
    height_icon.className = "fa fa-ellipsis-h";
    height_btn.appendChild(height_icon);

    // width resize dragable button
    const width_btn = document.createElement("div");
    width_btn.style.width = "18px";
    width_btn.style.height = "30px";
    width_btn.style.position = "absolute";
    width_btn.style.top = "50%";
    width_btn.style.right = "0";
    width_btn.style.transform = "translateY(-50%)";
    width_btn.style.cursor = "ew-resize";

    width_btn.style.border = "1px solid black"
    width_btn.style.borderRadius = "5px";
    width_btn.style.backgroundColor = "#FFFFFF";
    width_btn.style.transition = "background 0.2s";
    width_btn.onmouseover = () => width_btn.style.backgroundColor = "#AAAAAA";
    width_btn.onmouseout = () => width_btn.style.backgroundColor = "#FFFFFF";

    width_btn.style.display = "flex";
    width_btn.style.alignItems = "center";
    width_btn.style.justifyContent = "center";
    const width_icon = document.createElement("i");
    width_icon.className = "fa fa-ellipsis-v";
    width_btn.appendChild(width_icon);

    let width_resize = false;
    let height_resize = false;

    height_btn.addEventListener("mousedown", e => 
    {
        e.preventDefault();
        height_resize = true;
    });

    width_btn.addEventListener("mousedown", e => 
    {
        e.preventDefault();
        width_resize = true;
    });

    document.addEventListener("mousemove", e => 
    {
        if (!width_resize && !height_resize) return;

        // hide node-red selector box
        const rect = document.getElementsByClassName("nr-ui-view-lasso")[0];
        if (rect) 
        {
            rect.setAttribute("display", "none");
        }

        // calculate new size
        if (width_resize)
        {
            const width = e.clientX - log_div.getBoundingClientRect().left;
            foreign_object.setAttribute("width", width);
        }

        if (height_resize) 
        {
            const height = log_div.getBoundingClientRect().bottom - e.clientY;
            foreign_object.setAttribute("y", -height);
            foreign_object.setAttribute("height", height);
        }

    });

    document.addEventListener("mouseup", e => 
    {
        width_resize = false;
        height_resize = false;
    });

    // log
    const log_div = document.createElement("div");
    log_div.id = "node_" + id + "_log_div"
    log_div.className = "red-ui-flow-node-status-label";
    log_div.style.height = "calc(100% - 11px)";
    log_div.style.width = "calc(100% - 11px)";
    log_div.style.marginTop = "10px";
    log_div.style.marginRight = "10px";
    log_div.style.overflowY = "auto";
    log_div.style.whiteSpace = "pre-line";
    log_div.style.border = "1px solid black";
    log_div.style.borderRadius = "5px"
    div.insertBefore(log_div, div.firstChild);

    div.appendChild(close_btn);
    div.appendChild(width_btn);
    div.appendChild(height_btn);

    foreign_object.appendChild(div);
    node_svg.insertBefore(foreign_object, node_svg.firstChild);

}
    
function remove_log_window(id)
{
    const old = document.getElementById("node_" + id + "_log_window");
    if (old) old.remove();
}

function update_log(id, log)
{
    const log_div = document.getElementById("node_" + id + "_log_div");
    log_div.textContent = log;
    log_div.scrollTop = log_div.scrollHeight;
}