const DButils = require('./textdb-utils');

function TextReader(builder) {
	var self = this;
	self.ts = Date.now();
	self.cancelable = true;
	self.builders = [];
	self.canceled = 0;
	self.total = 0;
	builder && self.add(builder);
}

TextReader.prototype.add = function(builder) {
	var self = this;
	if (builder instanceof Array) {
		for (var i = 0; i < builder.length; i++)
			self.add(builder[i]);
	} else {
		builder.$TextReader = self;
		if (builder.$sortname)
			self.cancelable = false;
		self.builders.push(builder);
	}
	return self;
};

TextReader.prototype.compare2 = function(docs, custom, done) {
	var self = this;

	for (var i = 0; i < docs.length; i++) {

		var doc = docs[i];
		if (doc === EMPTYOBJECT)
			continue;

		if (self.builders.length === self.canceled) {
			self.total = 0;
			return false;
		}

		self.total++;
		var is = false;

		for (var j = 0; j < self.builders.length; j++) {

			var builder = self.builders[j];
			if (builder.canceled)
				continue;

			builder.scanned++;

			var can = false;

			try {
				can = builder.filterrule(doc, builder.filterarg, builder.tmp, builder.func);
			} catch (e) {
				can = false;
				builder.canceled = true;
				builder.error = e + '';
			}

			if (can) {

				builder.count++;

				if (!builder.$sortname && ((builder.$skip && builder.$skip >= builder.count) || (builder.$take && builder.$take <= builder.counter)))
					continue;

				!is && (is = true);

				builder.counter++;

				var canceled = builder.canceled;
				var c = custom(docs, doc, i, builder, j);

				if (builder.$take === 1) {
					builder.canceled = true;
					self.canceled++;
				} else if (!canceled && builder.canceled)
					self.canceled++;

				if (c === 1)
					break;
				else
					continue;
			}
		}

		is && done && done(docs, doc, i, self.builders);
	}
};

TextReader.prototype.compare = function(docs) {

	var self = this;

	self.total += docs.length;

	for (var i = 0; i < docs.length; i++) {

		var doc = docs[i];

		if (self.builders.length === self.canceled) {
			self.total = 0;
			return false;
		}

		for (var j = 0; j < self.builders.length; j++) {

			var builder = self.builders[j];
			if (builder.canceled)
				continue;

			builder.scanned++;

			var is = false;

			try {
				is = builder.filterrule(doc, builder.filterarg, builder.tmp, builder.func);
			} catch (e) {
				is = false;
				builder.canceled = true;
				builder.error = e + '';
			}

			if (is) {

				builder.count++;

				if (builder.scalarrule) {
					builder.counter++;
					try {
						builder.scalarrule(doc, builder.scalararg, builder.tmp, builder.func);
					} catch (e) {
						builder.canceled = true;
						builder.error = e + '';
					}
					continue;
				}

				if (!builder.$sortname && ((builder.$skip && builder.$skip >= builder.count) || (builder.$take && builder.$take <= builder.counter)))
					continue;

				builder.counter++;
				builder.push(doc);

				if (self.cancelable && !builder.$sortname && builder.response.length === builder.$take) {
					builder.canceled = true;
					self.canceled++;
				}
			}
		}
	}
};

TextReader.prototype.comparereverse = function(docs) {

	var self = this;

	self.total += docs.length;

	for (var i = docs.length - 1; i > -1; i--) {

		var doc = docs[i];

		if (self.builders.length === self.canceled) {
			self.total = 0;
			return false;
		}

		for (var j = 0; j < self.builders.length; j++) {

			var builder = self.builders[j];
			if (builder.canceled)
				continue;

			builder.scanned++;

			var is = false;

			try {
				is = builder.filterrule(doc, builder.filterarg, builder.tmp, builder.func);
			} catch (e) {
				is = false;
				builder.canceled = true;
				builder.error = e + '';
			}

			if (is) {

				builder.count++;

				if (builder.scalarrule) {
					builder.counter++;
					try {
						builder.scalarrule(doc, builder.scalararg, builder.tmp, builder.func);
					} catch (e) {
						builder.canceled = true;
						builder.error = e + '';
					}
					continue;
				}

				if (!builder.$sortname && ((builder.$skip && builder.$skip >= builder.count) || (builder.$take && builder.$take <= builder.counter)))
					continue;

				builder.counter++;
				builder.push(doc);

				if (self.cancelable && !builder.$sortname && builder.response.length === builder.$take) {
					builder.canceled = true;
					self.canceled++;
				}
			}
		}
	}
};

TextReader.prototype.callback = function(builder) {
	var self = this;

	if (builder.$sortname && !builder.$sorted)
		DButils.sortfinal(builder);

	for (var i = 0; i < builder.response.length; i++)
		builder.response[i] = builder.prepare(builder.response[i]);

	builder.logrule && builder.logrule();
	builder.done();
	return self;
};

TextReader.prototype.done = function() {

	var self = this;
	var diff = Date.now() - self.ts;

	if (self.db && self.db.duration) {
		if (self.total > 0)
			self.db.total = self.total;
		if (self.db.duration.push({ type: self.type, duration: diff }) > 20)
			self.db.duration.shift();
	}

	for (var i = 0; i < self.builders.length; i++) {
		var builder = self.builders[i];
		builder.duration = diff;
		builder.inmemory = self.inmemory;
		self.callback(builder);
	}

	self.canceled = 0;
	return self;
};

exports.make = function(builder) {
	return new TextReader(builder);
};