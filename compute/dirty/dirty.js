steal('can/util', 'can/compute', function(can, compute) {
	var oldCompute = can.compute;

	if(typeof Object.defineProperty !== 'function') {
		return;
	}

	var dirtyChecker = can.compute = function(obj, prop) {
		if(typeof obj === 'object' && typeof prop === 'string') {
			var comp = oldCompute(obj[prop]);

			Object.defineProperty(obj, prop, {
				enumerable: true,
				get: function() {
					return comp();
				},

				set: function(value) {
					comp(value);
				}
			});

			return comp;
		}
		return oldCompute.apply(this, arguments);
	};

	return dirtyChecker;
});
