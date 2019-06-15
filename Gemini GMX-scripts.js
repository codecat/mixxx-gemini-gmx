var GeminiGMX = {};

GeminiGMX._JogScratchAlpha = 0.125;
GeminiGMX._JogScratchBeta = GeminiGMX._JogScratchAlpha / 32.0;

GeminiGMX.IsSearching = false;

GeminiGMX.Reset = function() {
	// Turn all LEDs off
	for (var c = 0; c < 2; c++) {
		for (var i = 1; i <= 43; i++) {
			midi.sendShortMsg(0x90 + c, i, 0);
		}
	}
};

GeminiGMX.init = function(id, debugging) {
	GeminiGMX.Reset();
};

GeminiGMX.shutdown = function() {
	GeminiGMX.Reset();
};

GeminiGMX.Search = function(channel, control, value) {
	if (value > 0) {
		GeminiGMX.IsSearching = !GeminiGMX.IsSearching;
		midi.sendShortMsg(0x90 + channel, 26, GeminiGMX.IsSearching ? 127 : 0);
	}
};

GeminiGMX.JogTouch = function(channel, control, value) {
	if (value > 0) {
		engine.scratchEnable(channel + 1,
			128,
			33.3333333,
			GeminiGMX._JogScratchAlpha,
			GeminiGMX._JogScratchBeta,
			true
		);
		midi.sendShortMsg(0x90 + channel, 32, 127);
	} else {
		engine.scratchDisable(channel + 1, true);
		midi.sendShortMsg(0x90 + channel, 32, 0);
	}
};

GeminiGMX.JogSpin = function(channel, control, value) {
	var deckNumber = channel + 1;
	var delta = value - 64;

	if (GeminiGMX.IsSearching) {
		delta *= 8;
	}

	if (engine.isScratching(deckNumber)) {
		engine.scratchTick(deckNumber, delta);
	} else {
		engine.setValue('[Channel' + deckNumber + ']', 'jog', delta);
	}
};
