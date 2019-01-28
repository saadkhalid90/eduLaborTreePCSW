let labHierData;
let minRadius = 0;
let maxRadius = 300;

// define Scales
let radScale = d3.scaleSqrt().domain([0, 100]).range([minRadius, maxRadius]);
let colScale = d3.scaleOrdinal();

// define dimensions
let margin = {top: 20, right: 10, bottom: 20, left: 180},
    width = 1560 - margin.right - margin.left,
    height = 1000 - margin.top - margin.bottom;

// define counter, duration and root
let i = 0,
    duration = 500,
    root;

let uniqueEdu, uniqueInd

// define tree and diagonals;
let tree = d3.tree()
    .size([height, width]);

let diagonal = d3.linkHorizontal().x(d => d.y).y(d => d.x) // converts start and end point so we are going left to right instead of up and down

let svg = d3.select("#container")
    .append("svg")
    .attr("width", width + margin.right + margin.left)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");


async function readDataAndDraw(){
  let data = await d3.csv('laborHierarchyMS.csv');


  let edu = data.map(d => d.education);
  uniqueEdu = Array.from(new Set(edu));
  let ind = data.map(d => d.industry);
  uniqueInd = Array.from(new Set(ind));
  let categs = ['Employed', 'Rural', 'Urban', ...uniqueEdu].filter(d => d != "NA");
  let colors = ['grey', '#4db6ac', '#29b6f6', '#1b9e77','#d95f02','#7570b3','#e7298a','#66a61e','#e6ab02','#a6761d'];

  // set colScale domain and range
  colScale.domain(categs).range(colors);




  let seqData = preProcess(data);
  let seqSums = d3.nest()
                  .key(function(d) { return d.sequence; })
                  .rollup(v => d3.sum(v, row => row.weight ))
                  .entries(seqData);

  let sumNodes = d3.sum(seqSums, d => d.value);

  radScale.domain([0, sumNodes]);

  let seqSumsAoA = convArrOfArr(seqSums);
  let seqSumJSON = buildHierarchy(seqSumsAoA, "Employed");
  //radScale.domain()

  // setting the JSON data as root and setting initial position
  let seqSumJSONHier = d3.hierarchy(seqSumJSON);
  root = seqSumJSONHier
  tree(root);
  root.x0 = height/ 2;
  root.y0 = 0;


  function collapse(d) {
    if (d.children) {
      d._children = d.children;
      d._children.forEach(child => collapse(child));
      d.children = null;
    }
  }



  let sumTotal = d3.sum(root.leaves().map(d => d.data.size))


  root.descendants().forEach(desc => {
    desc.Perc = desc.children ? (d3.sum(desc.leaves().map(d => d.data.size))/sumTotal) * 100 : (desc.data.size/sumTotal) * 100
  })

  root.descendants().forEach(child => {
    if (["Urban", "Rural"].includes(child.data.name)) {
      child.layer = "Area";
    }
    else if (uniqueEdu.includes(child.data.name)){
      child.layer = "Education";
    }
    else if (uniqueInd.includes(child.data.name)){
      child.layer = "Industry";
    }
    else {
      child.layer = "Root";
    }
  });

  root.descendants().filter(desc => desc.layer == "Area").forEach(desc => {
    desc.children = desc.children.sort(function(a,b) {
      let order = ["No schooling", "Preschool/ Primary", "Middle", "Matric", "Intermediate", "Graduation", "Masters or above"];
      return order.indexOf(a.data.name) - order.indexOf(b.data.name);

    })
  })

  root.descendants().filter(desc => desc.layer == "Education").forEach(desc => {
    desc.children = desc.children.sort(function(a,b) {
      return b.Perc - a.Perc;
    })
  })


  root.children.forEach(collapse);
  update(root)

}

readDataAndDraw();

// define scales
// radius scale

d3.select(self.frameElement).style("height", "800px");

function update(source) {

  // Compute the new tree layout.
  tree(root);


  root.descendants().forEach(child => {
    if (["Urban", "Rural"].includes(child.data.name)) {
      child.layer = "Area";
    }
    else if (uniqueEdu.includes(child.data.name)){
      child.layer = "Education";
    }
    else if (uniqueInd.includes(child.data.name)){
      child.layer = "Industry";
    }
    else {
      child.layer = "Root";
    }
  });

  var nodes = root.descendants().reverse(),
      links = root.links();




  // Normalize for fixed-depth.
  nodes.forEach(function(d) { d.y = d.depth * 225; });


  // Update the nodes…
  var node = svg.selectAll("g.node")
      .data(nodes, function(d) {
        return d.id ? d.id : d.id = ++i;
      });


  // Enter any new nodes at the parent's previous position.
  var nodeEnter = node.enter().append("g")
      .attr("class", "node")
      .attr("transform", function(d) { return "translate(" + source.y0 + "," + source.x0 + ")"; })
      .on("click", click)
      .on('mouseover', mouseover(true))
      .on('mouseout', mouseover(false))

  nodeEnter.append("circle")
      .attr("r", 1)
      .style('fill', '#a6cee3')
      .style("fill-opacity", d => d.data.name != "Employed" ? 0.75 : 0);

  nodeEnter.append("text")
      .attr("x", function(d) { return d.children || d._children ? -15 : 20; })
      .attr("dy", ".35em")
      .attr("text-anchor", function(d) { return d.children || d._children ? "end" : "start"; })
      .attr("class", "text")
      .text(function(d) { return d.data.name; })
      .style("fill-opacity", 0)
      .style('font-size', d => `${18 - d.depth}px`);


  // Transition nodes to their new position.
  var nodeUpdate = node.merge(nodeEnter).transition()
      .duration(duration)
      .attr("transform", function(d) { return "translate(" + d.y + "," + d.x + ")"; });

  nodeUpdate.select("circle")
      .attr("r", function(d) {
        //return radScale(d.value)
        return radScale(d.Perc);
      })
      //.style("fill", function(d) { return d._children ? "grey" : "#0025A9"; });
      .style("fill", d => d._children || d.children ? colScale(d.data.name) : colScale(d.parent.data.name) )
      .style("fill-opacity", d => d.data.name != "Employed" ? 0.75 : 0);


  nodeUpdate.select("text")
      .style("fill-opacity", 1);

  // Transition exiting nodes to the parent's new position.
  var nodeExit = node.exit().transition()
      .duration(duration)
      .attr("transform", function(d) { return "translate(" + source.y + "," + source.x + ")"; })
      .remove();

  nodeExit.select("circle")
      .attr("r", 1e-6);

  nodeExit.select("text")
      .style("fill-opacity", 1e-6);

  // Update the links…
  var link = svg.selectAll("path.link")
      .data(links, function(d) { return d.target.id; });

  // Enter any new links at the parent's previous position.
  var linkEnter =  link.enter().insert("path", "g")
      //.append('path')
      //.attr("class", "link")
      .attr("d", function(d) {
        var o = {x: source.x0, y: source.y0};
        return diagonal({source: o, target: o});
      })
      .style('stroke-width', d => d.target.Perc)
      .classed('link', true)
      .attr('id', d => `ID${d.target.id}`);

  // Transition links to their new position.
  link.merge(linkEnter).transition()
      .duration(duration)
      .attr("d", diagonal)
      .style('stroke-width', d => (2*radScale(d.target.Perc)))
      .style("stroke", d => d.target._children || d.target.children ? colScale(d.target.data.name) : colScale(d.target.parent.data.name) );;

  // Transition exiting nodes to the parent's new position.
  link.exit().transition()
      .duration(duration)
      .attr("d", function(d) {
        var o = {x: source.x, y: source.y};
        return diagonal({source: o, target: o});
      })
      .remove();

  // Stash the old positions for transition.
  nodes.forEach(function(d) {
    d.x0 = d.x;
    d.y0 = d.y;
  });
}


// Toggle children on click.
function click(d) {
  if (d.children) {
    d._children = d.children;
    d.children = null;
  } else {
    d.children = d._children;
    d._children = null;
  }
  update(d);
}

function mouseover(over) {

  return function(d){
    let arrIDNames = d.ancestors().map(d => d.id);

    let classCSS = arrIDNames.map(d => `#ID${d}`).join(", ")
    let selection = d3.selectAll(classCSS);
    let textSelect = d3.select(this).select('text')

    if (over == true){
      selection.style('stroke-opacity', 1);
      textSelect.transition().duration(180).style('font-size', d => `${(18 - d.depth) * 1.4}px`);
    }
    else {
      selection.style('stroke-opacity', .2);
      textSelect.transition().duration(180).style('font-size', d => `${18 - d.depth}px`);
    }
  }
}


function preProcess(dataSet){
  let filtData = dataSet.filter(row => row.employment == "employed");

  let procData = filtData.map(d => {
    return {
      sequence: `${d.area}-${d.education}-${d.industry}`,
      weight: d.weight
    }
  })
  return procData;
}

function convArrOfArr(dataset){
  let arrOfArr = dataset.map(d => {
    // each row is returned as an array of key and value
    return [d.key, +d.value];
  })
  return arrOfArr;
}

function buildHierarchy(csv, rootName) {
    var root = {"name": rootName, "children": []};
    for (var i = 0; i < csv.length; i++) {
      var sequence = csv[i][0];
      var size = +csv[i][1];
      if (isNaN(size)) { // e.g. if this is a header row
        continue;
      }
      var parts = sequence.split("-");

      var currentNode = root;
      for (var j = 0; j < parts.length; j++) {
        var children = currentNode["children"];
        var nodeName = parts[j];
        var childNode;
        if (j + 1 < parts.length) {
          // Not yet at the end of the sequence; move down the tree.
          var foundChild = false;
          for (var k = 0; k < children.length; k++) {
            if (children[k]["name"] == nodeName) {
              childNode = children[k];
              foundChild = true;
              break;
            }
          }
          // If we don't already have a child node for this branch, create it.
          if (!foundChild) {
            childNode = {"name": nodeName, "children": []};
            children.push(childNode);
          }
          currentNode = childNode;
        } else {
          // Reached the end of the sequence; create a leaf node.
          childNode = {"name": nodeName, "size": size};
          children.push(childNode);
        }
      }
    }

    return root;
};
