steal("can/util", "can/compute/dirty", "can/test", function (can) {
	module('can/compute/dirty');

	test('initializes and makes new properties computable', function () {
		expect(5);

		var myObject = {};
		var compute = can.compute(myObject, 'name');

		equal(compute(), undefined, 'Initial value is undefined');

		compute.bind('change', function(ev, newVal, oldVal) {
			if(oldVal === undefined) {
				equal(newVal, 'Something', 'Got new value');
			} else {
				equal(oldVal, 'Something', 'Got old value');
				equal(newVal, 'bla', 'New value set');
			}
		});

		myObject.name = 'Something';

		compute('bla');

		equal(myObject.name, 'bla', 'Updated compute updated property');
	});

	test('makes existing and multiple properties computable', function () {
		expect(10);

		var myObject = { name: 'test', other: 'value' };
		var name = can.compute(myObject, 'name');
		var other = can.compute(myObject, 'other');

		equal(name(), 'test', 'Got existing value');
		equal(other(), 'value', 'Got existing value');
		equal(myObject.name, 'test');
		equal(myObject.other, 'value');

		name.bind('change', function(ev, newVal, oldVal) {
			if(oldVal === 'test') {
				equal(newVal, 'David');
				equal(oldVal, 'test');
			}

			if(oldVal === 'David') {
				equal(newVal, 'daffl');
			}
		});

		myObject.name = 'David';

		other.bind('change', function(ev, newVal, oldVal) {
			equal(newVal, 'bla');
			equal(oldVal, 'value');
		});

		myObject.other = 'bla';
		name('daffl');

		equal(myObject.name, 'daffl');
	});
});
