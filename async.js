exports.async = function () {
	var o = {
		callback: null,
		inprocess: 0,
		returns: {},
		push: function () {
			o.inprocess++;
			var fn = arguments[arguments.length - 1];
			arguments[arguments.length - 1] = o.iteration;
			fn.apply(o, arguments);
		},
		iteration: function () {
			var args = arguments;
			process.nextTick(function () {
				if (!--o.inprocess)
					o.callback(args.callee);
			})
		},
		done: function (cb) {
			this.callback = cb;
		}
	}

	// if we have one callback
	if (arguments.length == 1) {
		o.callback = arguments[0];
		return o;
	}
	// if we have array of callbacks
	if (arguments.length == 2) {
		for (var i = 0; i < arguments[0].length; i++)
			o.push.apply(null, arguments[0][i]);
		o.callback = arguments[1];
		return o;
	}
	// if we have callbacks
	if (arguments.length > 2) {
		o.callback = arguments[arguments.length - 1];
		for (var i = 0; i < arguments.length - 1; i++)
			o.push(arguments[i]);
	}
	return false;
}


exports.sync = function () {
	var o = {
		items: [],
		next: function () {
			if (o.items.length > 0){
				if (o.items.length > 0)
					o.items.shift()(o.next);
			}
		}
	}
	if (arguments.length == 1)
		o.items = arguments[0];
	else {
		for (var i = 0; i < arguments.length; i++)
			o.items.push(arguments[i]);
	}
	o.items.shift()(o.next);
	return false;
}
