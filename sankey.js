function Sankey(container, data) {
  
	var self = this,
		MARGIN = 10,
		PADDING = 2,
		INNER_RADIUS = 30,
		_container, _data, _width, _height, _root, _group, _columns, _columnWidth, _scale, _arrow, _leak;

	self.size = function(size) {
		if(arguments.length) {
			_container.attr("width", size[0]);
			_container.attr("height", size[1]);
			_width = _container.node().clientWidth;
			_height = _container.node().clientHeight;
		} else {
			return [_width, _height];
		}
	}

	self.render = function () {

		var out,
			reserves = _data.find(function (d) { return d.reserves;});

		_columnWidth = _width / (Math.max(_columns.forward.length, _columns.backward.length) + 5);
		
		out = 0;
		_columns.forward.reverse();
		_columns.forward.forEach(function(column) {
			column.forEach(function(link, index, links) {
				if(!link.children.length) {
					link.out = out;
					out++;
				}
			});
		});
		_columns.forward.reverse();
		out = 0;
		_columns.backward.forEach(function(column) {
			column.forEach(function(link, index, links) {
				if(!link.children.length) {
					link.out = out;
					out++;
				}
			});
		});

		_scale = Math.min((_height - linkCount(_columns.forward) * MARGIN) / (reserves.value + reserves.reserves), (_height - INNER_RADIUS * 2 - (linkCount(_columns.backward) + linkCount(_columns.forward)) * MARGIN) / (maxValue(_columns.forward) + maxValue(_columns.backward)));
		
		_columns.forward.forEach(function(column) {
			var offset = 0;
			column.forEach(function(link, index, links) {
				link.strokeWidth = link.value * _scale;
				link.offset = offset;
				offset += link.fix? link.fix * _scale : link.strokeWidth;
			});
		});
		_columns.backward.forEach(function(column) {
			var offset = 0;
			column.forEach(function(link, index, links) {
				if(!index && link.parent.children.indexOf(_root) != -1) {
					offset += _root.strokeWidth;
				}
				link.strokeWidth = link.value * _scale;
				link.offset = offset;
				offset += link.strokeWidth;
			});
		});

		_group
			.selectAll(".column")
				.data(d3.merge([_columns.forward,_columns.backward]))
				.enter()
				.append("g")
				.attr("class", "column")
			.selectAll("path")
				.data(function (d) {return d;})
				.enter()
				.append("path");

		_group
			.selectAll(".column path")
				.attr("d", function(d) {return draw(d)})
				.attr("fill", function(d) { return d.fix || d.reserves? d.color : "none"; })
				.attr("stroke", function(d) { return d.fix  || d.reserves? "none" : d.color; })
				.attr("stroke-width", function(d) { return d.fix || d.reserves? 0 : d.strokeWidth});
				
		_group
			.selectAll(".column")
			.selectAll("text")
				.data(function (d) {return d;})
				.enter()
					.append("text");

		_group
			.selectAll(".column text")
					.attr("fill", function(d) { return d.children.length || d.reserves? "white" : d.color; })
					.attr("text-anchor", function(d) { return d.children.length || (d.parent == null && d.reserves)? "middle" : (d.parent == null || d.backward? "end" : "start"); })
					.attr("x", textX)
					.attr("y", textY)
					.text(function(d) { return d.target; }).each(wrap);

		_group.attr("transform", "translate(" + (_leak? _columnWidth : 0) +  " " + (_height - linkCount(_columns.forward) * MARGIN - maxValue(_columns.forward) * _scale - INNER_RADIUS) + ")");
  
	}

	function textX(d) {
		var x;
		if(d.backward) {
			if(d.children.length) {
				x = (_columns.backward.length - d.depth + 1) * _columnWidth - _columnWidth / 2;
			} else {
				x = _columnWidth - MARGIN;
			}
		} else {
			if(d.children.length || (d.parent == null && d.reserves)) {
				x = (d.depth + 2) * _columnWidth + _columnWidth / 2;
			} else {
				x = _width - _columnWidth * 2 + MARGIN;
			}
		}
		return x;
	}

	function textY(d) {
		var y;
		if(d.backward) {
			y = -d.offset - d.strokeWidth / 2 - INNER_RADIUS;
			if(!d.children.length) {
				y -= d.out * MARGIN;
			}
		} else {
			y = d.offset + (d.fix? d.fix * _scale : d.strokeWidth) / 2 + INNER_RADIUS;
			if(d.parent && !d.children.length) {
				y += d.out * MARGIN;
			}
		}
		return y;
	}

	function draw(link) {
		var offsetY, d, pathFunction,
			direction = link.backward? "backward" : "forward",
			orphan = link.parent == null;

			switch(direction) {
				case "forward":
					if(link.reserves) {
						pathFunction = orphan? reservesOutPath : reservesInPath;
					} else if(link.fix) {
						pathFunction = forwardFixPath;
					} else if(link.children.length) {
						pathFunction = forwardParentPath;
					} else {
						pathFunction = forwardPath;
					}
					break;
				case "backward":
					if(!link.parent.backward) {
						pathFunction = backwardTurnPath;
					} else {
						pathFunction = backwardPath;					
					}
					break;
			}

		return pathFunction(link);
	}

	function forwardFixPath(link) {
		_arrow
			.attr("opacity", 0.25)
			.attr("fill", "none")
			.attr("stroke", "white")
			.attr("stroke-width", "12")
			.attr("marker-end", "url(#arrow)")
			.attr("d", function() {
				return "M" + (_columns.backward.length - link.parent.depth) * _columnWidth + " " + (-INNER_RADIUS - link.strokeWidth / 2)
					   +  "a1 1 0 1 0 0 " + (link.strokeWidth / 2 + INNER_RADIUS * 2 + link.fix / 2 * _scale);
			})
			.moveToFront();

		var d = "M" + (_columns.backward.length - link.parent.depth) * _columnWidth + " " + (-INNER_RADIUS - link.offset)
			  +  "v-" +  link.strokeWidth
			  +  "a1 1 0 1 0 0 " + (link.strokeWidth + INNER_RADIUS * 2 + link.fix * _scale)
			  +  "h" + (_columnWidth - PADDING)
			  +  "v-" +  link.fix * _scale
			  +  "h-" + (_columnWidth - PADDING)
			  +  "a1 1 0 1 1 0 -" + INNER_RADIUS * 2;

		return d;
	}

	function forwardParentPath(link) {
		var offsetY = INNER_RADIUS + link.offset + link.strokeWidth / 2,
			d = "M" + (link.depth + 2) * _columnWidth + " " + offsetY
			  + "h" + (_columnWidth - PADDING);

		return d;			
	}

	function forwardPath(link) {
		var offsetY = INNER_RADIUS + link.offset + link.strokeWidth / 2,
			height = link.out * MARGIN;
			d = "M" + (link.depth + 2) * _columnWidth + " " + offsetY
			  + "q" + (_columnWidth * 0.25) + " 0, " + _columnWidth * 0.5 + "  " + height * 0.5 + "t" + _columnWidth * 0.5 + " " + height * 0.5
			  + "H" + (_width - _columnWidth * 2);

		return d;
	}

	function backwardTurnPath(link) {
		
		var d = "M" + (link.parent.depth + 3) * _columnWidth + " " + (INNER_RADIUS + link.parent.offset + link.strokeWidth / 2)
			  +  "a1 1 0 1 0 0 -" + (link.strokeWidth + INNER_RADIUS * 2) 
			  +  "h" + ((-_columns.forward.length + link.depth) * _columnWidth + PADDING);
		return d;
	}

	function backwardPath(link) {
		var offsetY = -INNER_RADIUS - link.offset - link.strokeWidth / 2,
			height = link.out * -MARGIN,
			d = "M" + (_columns.backward.length - link.depth + 1) * _columnWidth + " " + offsetY
		  	  + "q" + (-_columnWidth * 0.25) + " 0, " + -_columnWidth * 0.5 + "  " + height * 0.5 + "t" + -_columnWidth * 0.5 + " " + height * 0.5
		  	  + "H" + _columnWidth;

		return d;
	}

	function reservesInPath(link) {
		var offsetY = INNER_RADIUS + link.offset,
			height = link.out * MARGIN;
			d = "M" + (link.depth + 2) * _columnWidth + " " + offsetY
			  + "q" + _columnWidth * 0.25 + " 0, " + _columnWidth * 0.5 + "  " + height * 0.5 + "t" + _columnWidth * 0.5 + " " + height * 0.5
			  + "H" + (_width - _columnWidth)
  			  + "v" + link.reserves * -_scale
  			  + river(_columnWidth, 8)
  			  + "v" + link.reserves * _scale
			  + "a" + link.strokeWidth + " " + link.strokeWidth + " 0 0 1 " + link.strokeWidth * -1 + " " + link.strokeWidth
			  + "H" + (link.depth + 3) * _columnWidth
			  + "q" + _columnWidth * -0.25 + " 0," + _columnWidth * -0.5 + "  " + height * -0.5 + "t" + _columnWidth * -0.5 + " " + height * -0.5
			  + "z";

		_mask.attr("d", d);
	  	_group.selectAll(".mark").remove()
		_group.selectAll(".mark")
			.data(d3.range(link.reserves / link.value))
			.enter()
			.append("path")
			.attr("clip-path", "url(#mask)")
			.attr("class", function (d) { return d? "mark" : "mark padding"})
			.attr("d", function(d) { return "M" + (_width - _columnWidth) + " " + (INNER_RADIUS + height + link.offset - PADDING / 2 - d * link.value * _scale) + "h" + (_columnWidth + link.strokeWidth / 2)})

		return d;
	}

	function reservesOutPath(link) {
		var offsetY = (INNER_RADIUS + link.offset + link.strokeWidth / 2),
			d = "M" + (_columnWidth * 3 - PADDING) + " " + (offsetY - link.strokeWidth / 2)
		  			+ "v" + link.strokeWidth
		  			+ "H" + (-_columnWidth + link.strokeWidth / 2)
		  			+ "a" + link.strokeWidth / 2 + " " + link.strokeWidth / 2 + " 0 0 1 " + link.strokeWidth / -2 + " " + link.strokeWidth / -2
		  			+ "v" + ((link.reserves + link.value) * -_scale + link.strokeWidth / 2)
		  			+ river(_columnWidth, 8)
		  			+ "v" + (link.reserves * _scale)
		  			+ "z";

	  	_mask.attr("d", d);
	  	_group.selectAll(".mark").remove()
		_group.selectAll(".mark")
			.data(d3.range(link.reserves / link.value))
			.enter()
			.append("path")
			.attr("clip-path", "url(#mask)")
			.attr("class", function (d) { return d? "mark" : "mark padding"})
			.attr("d", function(d) { return "M" + (-_columnWidth) + " " + (INNER_RADIUS + link.offset - PADDING / 2 - d * link.value * _scale) + "h" + (_columnWidth + link.strokeWidth / 2)})

		return d;
	}

	function river(width, waves) {
		for(var length = width / waves, d = "", i = 0; i < waves; i++) {
			d += "a" + length + " " + length + " 0 0 0 " + length + " 0";
		}
		return d;
	}

	function maxValue(columns) {
		return d3.max(columns, function (column) { return d3.sum(column, function (link) { return link.value;})})
	}

	function linkCount(columns) {
		return d3.max(columns, function (column) { return d3.max(column, function (link) { return link.out})});
	}

	function init(container, data) {
		_container = d3.select(container);
		_data = data;
		_leak = _data.find(function (d) { return d.reserves;}).source == null;
		_root = _data.find(function (d) { return d.target == "billing"});
		_data.forEach(function(link) {
			link.children = data.filter(function (d) { return d.source == link.target;});
			link.children.forEach(function (child) {
				child.parent = link;
			});
		});

		data.forEach(function(link) {
			link.depth = depth(link, 0)
		});

		_columns = {forward:[], backward:[]};
		data.forEach(function(link) {
			var direction = link.backward? "backward" : "forward";
			var index = link.depth;
			_columns[direction][index] = _columns[direction][index] || [];
			_columns[direction][index].push(link);
		});

		_group = _container.append("g");
		_arrow = _group.append("path");
		_mask = _group.append("clipPath")
    				.attr("id", "mask")
  					.append("path");   
	}

	function depth(link, value) {
		return link.parent == null || link == _root || link.backward != link.parent.backward? value : depth(link.parent, value + 1);
	}

	function wrap() {
        var self = d3.select(this),
            textLength = self.node().getComputedTextLength(),
            text = self.text(),
            title = text;
        while (textLength > _columnWidth - MARGIN * 2 && text.length > 0) {
            text = text.slice(0, -1);
            self.text(text + '...');
            textLength = self.node().getComputedTextLength();
        }
        if(text != title) {
	        self.append("title")
	        	.text(title);   	
        }
    } 

	init(container, data);
}

d3.selection.prototype.moveToFront = function() {  
      return this.each(function(){
        this.parentNode.appendChild(this);
      });
    };

d3.selection.prototype.moveToBack = function() {  
    return this.each(function() { 
        var firstChild = this.parentNode.firstChild; 
        if (firstChild) { 
            this.parentNode.insertBefore(this, firstChild); 
        } 
    });
};