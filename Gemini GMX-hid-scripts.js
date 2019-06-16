var GeminiGMXHid = {};

GeminiGMXHid._JogScratchAlpha = 0.125;
GeminiGMXHid._JogScratchBeta = GeminiGMXHid._JogScratchAlpha / 32.0;

function readUint16(data, offset)
{
	var b1 = data[offset];
	var b2 = data[offset + 1];
	return (b2 << 8 | b1);
}

function readInt32(data, offset)
{
	var b1 = data[offset];
	var b2 = data[offset + 1];
	var b3 = data[offset + 2];
	var b4 = data[offset + 3];
	var ret = ((b4 & 0x7F) << 24) | (b3 << 16) | (b2 << 8) | b1;
	if (b4 & 0x80) {
		return -ret;
	} else {
		return ret;
	}
}

GeminiGMXHid.init = function(id, debugging) {
	GeminiGMXHid.prevData = null;

	GeminiGMXHid.IsSearching = false;

	GeminiGMXHid.UpdateBuffer = [];
	for (var i = 0; i < 64; i++) {
		GeminiGMXHid.UpdateBuffer.push(0);
	}

	GeminiGMXHid.update();
	GeminiGMXHid.UpdateTimer = engine.beginTimer(10, "GeminiGMXHid.update()");
};

GeminiGMXHid.shutdown = function() {
	engine.stopTimer(GeminiGMXHid.UpdateTimer);
};

GeminiGMXHid.getBit = function(data, offset, bitpos) {
	var b = data[offset];
	return !!(b & (1 << bitpos));
};

GeminiGMXHid.checkBit = function(data, offset, bitpos, onChanged, ud) {
	var now = GeminiGMXHid.getBit(data, offset, bitpos);
	if (!GeminiGMXHid.prevData) {
		onChanged(null, now, ud);
		return;
	}

	var prev = GeminiGMXHid.getBit(GeminiGMXHid.prevData, offset, bitpos);
	if (prev != now) {
		onChanged(prev, now, ud);
	}
};

GeminiGMXHid.toggleButton = function(group, key) {
	engine.setParameter(group, key, !engine.getParameter(group, key));
};

GeminiGMXHid.checkChanged8 = function(data, offset, onChanged, ud) {
	var now = data[offset];
	if (!GeminiGMXHid.prevData) {
		onChanged(null, now, ud);
		return;
	}

	var prev = GeminiGMXHid.prevData[offset];
	if (prev != now) {
		onChanged(prev, now, ud);
	}
};

GeminiGMXHid.checkChanged16 = function(data, offset, onChanged, ud) {
	var now = readUint16(data, offset);
	if (!GeminiGMXHid.prevData) {
		onChanged(null, now, ud);
		return;
	}

	var prev = readUint16(GeminiGMXHid.prevData, offset);
	if (prev != now) {
		onChanged(prev, now, ud);
	}
};

GeminiGMXHid.updateDeckLeds = function(deck) {
	var group = "[Channel" + deck + "]";

	var offset = 1;
	if (deck == 2) {
		offset = 4;
	}

	GeminiGMXHid.UpdateBuffer[offset] = 0;
	GeminiGMXHid.UpdateBuffer[offset + 1] = 0;
	GeminiGMXHid.UpdateBuffer[offset + 2] = 0;

	if (GeminiGMXHid.IsSearching) { GeminiGMXHid.UpdateBuffer[offset] |= (1 << 0); }
	if (engine.isScratching(deck)) { GeminiGMXHid.UpdateBuffer[offset] |= (1 << 1); }

	if (engine.getParameter(group, "beat_active")) { GeminiGMXHid.UpdateBuffer[offset] |= (1 << 2); }

	if (engine.getParameter(group, "cue_indicator")) { GeminiGMXHid.UpdateBuffer[offset] |= (1 << 6); }
	if (engine.getParameter(group, "play_indicator")) { GeminiGMXHid.UpdateBuffer[offset] |= (1 << 7); }

	for (var i = 0; i < 8; i++) {
		if (engine.getParameter(group, "hotcue_" + (i + 1) + "_enabled")) {
			GeminiGMXHid.UpdateBuffer[offset + 1] |= (1 << (7 - i));
		}
	}

	if (engine.getParameter(group, "pfl")) { GeminiGMXHid.UpdateBuffer[offset + 2] |= (1 << 5); }
	if (engine.getParameter(group, "keylock")) { GeminiGMXHid.UpdateBuffer[offset + 2] |= (1 << 6); }
	if (engine.getParameter(group, "reverse")) { GeminiGMXHid.UpdateBuffer[offset + 2] |= (1 << 7); }
};

GeminiGMXHid.update = function() {
	// This function is called every 50ms and manually whenever an update is necessary

	// Set the deck LEDs
	GeminiGMXHid.updateDeckLeds(1);
	GeminiGMXHid.updateDeckLeds(2);

	// Set the VU meter
	GeminiGMXHid.UpdateBuffer[7] = engine.getParameter("[Master]", "VuMeterL") * 8;
	GeminiGMXHid.UpdateBuffer[8] = engine.getParameter("[Master]", "VuMeterR") * 8;

	controller.send(GeminiGMXHid.UpdateBuffer, GeminiGMXHid.UpdateBuffer.length, 0);
};

GeminiGMXHid.incomingData = function(data, length) {
	var checkDeckButtons = function(data, offset, bitpos, onChanged, ud) {
		GeminiGMXHid.checkBit(data, offset, bitpos, onChanged, ud ? [ 1, ud ] : 1);
		GeminiGMXHid.checkBit(data, 16 + offset, bitpos, onChanged, ud ? [ 2, ud ] : 2);
	};

	// Buttons
	checkDeckButtons(data, 0, 6, GeminiGMXHid.buttonPlay);
	checkDeckButtons(data, 0, 5, GeminiGMXHid.buttonCue);
	checkDeckButtons(data, 0, 4, GeminiGMXHid.buttonLoopIn);
	checkDeckButtons(data, 0, 3, GeminiGMXHid.buttonLoopOut);
	checkDeckButtons(data, 0, 2, GeminiGMXHid.buttonReloopExit);
	checkDeckButtons(data, 0, 1, GeminiGMXHid.buttonHotCueOffOn);
	checkDeckButtons(data, 0, 0, GeminiGMXHid.buttonLoopDouble);
	checkDeckButtons(data, 1, 7, GeminiGMXHid.buttonLoopHalf);
	checkDeckButtons(data, 2, 6, GeminiGMXHid.buttonBpmTapMode);
	checkDeckButtons(data, 2, 5, GeminiGMXHid.buttonBpmLock);
	checkDeckButtons(data, 2, 4, GeminiGMXHid.buttonKeyLock);
	checkDeckButtons(data, 2, 3, GeminiGMXHid.buttonRange);
	checkDeckButtons(data, 2, 2, GeminiGMXHid.buttonTime);
	checkDeckButtons(data, 2, 1, GeminiGMXHid.buttonText);
	checkDeckButtons(data, 2, 0, GeminiGMXHid.buttonAutoCue);
	checkDeckButtons(data, 3, 7, GeminiGMXHid.buttonRepeat);
	checkDeckButtons(data, 3, 5, GeminiGMXHid.buttonSearch);
	checkDeckButtons(data, 3, 4, GeminiGMXHid.buttonJogTouch);
	checkDeckButtons(data, 3, 3, GeminiGMXHid.buttonBrowseSelect);
	checkDeckButtons(data, 3, 2, GeminiGMXHid.buttonBrowseBack);
	checkDeckButtons(data, 4, 7, GeminiGMXHid.buttonScratch);
	checkDeckButtons(data, 4, 6, GeminiGMXHid.buttonReverse);
	checkDeckButtons(data, 4, 5, GeminiGMXHid.buttonHeadphones);
	checkDeckButtons(data, 5, 4, GeminiGMXHid.buttonShift);

	// Hotcue buttons 1 through 8
	checkDeckButtons(data, 1, 6, GeminiGMXHid.buttonHotcue, 1);
	checkDeckButtons(data, 1, 5, GeminiGMXHid.buttonHotcue, 2);
	checkDeckButtons(data, 1, 4, GeminiGMXHid.buttonHotcue, 3);
	checkDeckButtons(data, 1, 3, GeminiGMXHid.buttonHotcue, 4);
	checkDeckButtons(data, 4, 4, GeminiGMXHid.buttonHotcue, 5);
	checkDeckButtons(data, 4, 3, GeminiGMXHid.buttonHotcue, 6);
	checkDeckButtons(data, 4, 2, GeminiGMXHid.buttonHotcue, 7);
	checkDeckButtons(data, 4, 1, GeminiGMXHid.buttonHotcue, 8);

	// Hotcue buttons 1 through 8 with shift
	checkDeckButtons(data, 1, 2, GeminiGMXHid.buttonShiftHotcue, 1);
	checkDeckButtons(data, 1, 1, GeminiGMXHid.buttonShiftHotcue, 2);
	checkDeckButtons(data, 1, 0, GeminiGMXHid.buttonShiftHotcue, 3);
	checkDeckButtons(data, 2, 7, GeminiGMXHid.buttonShiftHotcue, 4);
	checkDeckButtons(data, 4, 0, GeminiGMXHid.buttonShiftHotcue, 5);
	checkDeckButtons(data, 5, 7, GeminiGMXHid.buttonShiftHotcue, 6);
	checkDeckButtons(data, 5, 6, GeminiGMXHid.buttonShiftHotcue, 7);
	checkDeckButtons(data, 5, 5, GeminiGMXHid.buttonShiftHotcue, 8);

	// Controls
	GeminiGMXHid.checkChanged16(data, 6, GeminiGMXHid.changedMasterVolume);
	GeminiGMXHid.checkChanged16(data, 22, GeminiGMXHid.changedCueVolume);
	GeminiGMXHid.checkChanged16(data, 61, GeminiGMXHid.changedBoothVolume);
	GeminiGMXHid.checkChanged16(data, 54, GeminiGMXHid.changedCueMix);

	GeminiGMXHid.checkChanged16(data, 52, GeminiGMXHid.changedCrossFade);
	GeminiGMXHid.checkChanged16(data, 48, GeminiGMXHid.changedVolume, 1);
	GeminiGMXHid.checkChanged16(data, 50, GeminiGMXHid.changedVolume, 2);

	GeminiGMXHid.checkChanged8(data, 56, GeminiGMXHid.changedCueMaster);

	GeminiGMXHid.checkChanged8(data, 57, GeminiGMXHid.changedBrowse);

	GeminiGMXHid.checkChanged16(data, 8, GeminiGMXHid.changedRate, 1);
	GeminiGMXHid.checkChanged16(data, 24, GeminiGMXHid.changedRate, 2);

	GeminiGMXHid.checkChanged16(data, 14, GeminiGMXHid.changedJog, 1);
	GeminiGMXHid.checkChanged16(data, 30, GeminiGMXHid.changedJog, 2);

	GeminiGMXHid.checkChanged16(data, 32, GeminiGMXHid.changedGain, 1);
	GeminiGMXHid.checkChanged16(data, 34, GeminiGMXHid.changedGain, 2);

	GeminiGMXHid.checkChanged16(data, 40, GeminiGMXHid.changedHighs, 1);
	GeminiGMXHid.checkChanged16(data, 42, GeminiGMXHid.changedHighs, 2);

	GeminiGMXHid.checkChanged16(data, 36, GeminiGMXHid.changedMids, 1);
	GeminiGMXHid.checkChanged16(data, 38, GeminiGMXHid.changedMids, 2);

	GeminiGMXHid.checkChanged16(data, 44, GeminiGMXHid.changedLows, 1);
	GeminiGMXHid.checkChanged16(data, 46, GeminiGMXHid.changedLows, 2);

	GeminiGMXHid.checkChanged16(data, 12, GeminiGMXHid.changedFilter, 1);
	GeminiGMXHid.checkChanged16(data, 28, GeminiGMXHid.changedFilter, 2);

	GeminiGMXHid.prevData = data;
};

GeminiGMXHid.buttonPlay = function(prev, now, ud) {
	if (now) {
		GeminiGMXHid.toggleButton("[Channel" + ud + "]", "play");
	}
};

GeminiGMXHid.buttonCue = function(prev, now, ud) {
	engine.setParameter("[Channel" + ud + "]", "cue_default", now);
};

GeminiGMXHid.buttonLoopIn = function(prev, now, ud) {
	//
};

GeminiGMXHid.buttonLoopOut = function(prev, now, ud) {
	//
};

GeminiGMXHid.buttonReloopExit = function(prev, now, ud) {
	if (now) {
		GeminiGMXHid.toggleButton("[Channel" + ud + "]", "reloop_toggle");
	}
};

GeminiGMXHid.buttonHotCueOffOn = function(prev, now, ud) {
	//
};

GeminiGMXHid.buttonLoopDouble = function(prev, now, ud) {
	//
};

GeminiGMXHid.buttonLoopHalf = function(prev, now, ud) {
	//
};

GeminiGMXHid.buttonHotcue = function(prev, now, ud) {
	// ud = [ deck, cue number ]
};

GeminiGMXHid.buttonShiftHotcue = function(prev, now, ud) {
	// ud = [ deck, cue number ]
};

GeminiGMXHid.buttonBpmTapMode = function(prev, now, ud) {
	//
};

GeminiGMXHid.buttonBpmLock = function(prev, now, ud) {
	//
};

GeminiGMXHid.buttonKeyLock = function(prev, now, ud) {
	if (now) {
		GeminiGMXHid.toggleButton("[Channel" + ud + "]", "keylock");
	}
};

GeminiGMXHid.buttonRange = function(prev, now, ud) {
	//
};

GeminiGMXHid.buttonTime = function(prev, now, ud) {
	//
};

GeminiGMXHid.buttonText = function(prev, now, ud) {
	//
};

GeminiGMXHid.buttonAutoCue = function(prev, now, ud) {
	//
};

GeminiGMXHid.buttonRepeat = function(prev, now, ud) {
	if (now) {
		GeminiGMXHid.toggleButton("[Channel" + ud + "]", "repeat");
	}
};

GeminiGMXHid.buttonSearch = function(prev, now, ud) {
	if (now) {
		GeminiGMXHid.IsSearching = !GeminiGMXHid.IsSearching;
	}
};

GeminiGMXHid.buttonJogTouch = function(prev, now, ud) {
	if (now) {
		engine.scratchEnable(ud,
			128,
			33.3333333,
			GeminiGMXHid._JogScratchAlpha,
			GeminiGMXHid._JogScratchBeta,
			true
		);
	} else {
		engine.scratchDisable(ud, true);
	}
};

GeminiGMXHid.buttonBrowseSelect = function(prev, now, ud) {
	engine.setParameter("[Library]", "GoToItem", now);
};

GeminiGMXHid.buttonBrowseBack = function(prev, now, ud) {
	engine.setParameter("[Library]", "MoveFocusForward", now);
};

GeminiGMXHid.buttonScratch = function(prev, now, ud) {
	//
};

GeminiGMXHid.buttonReverse = function(prev, now, ud) {
	if (now) {
		GeminiGMXHid.toggleButton("[Channel" + ud + "]", "reverse");
	}
};

GeminiGMXHid.buttonHeadphones = function(prev, now, ud) {
	if (now) {
		GeminiGMXHid.toggleButton("[Channel" + ud + "]", "pfl");
	}
};

GeminiGMXHid.buttonShift = function(prev, now, ud) {
	//
};

GeminiGMXHid.changedMasterVolume = function(prev, now) {
	engine.setParameter("[Master]", "gain", (600 - now) / 600.0);
};

GeminiGMXHid.changedCueVolume = function(prev, now) {
	engine.setParameter("[Master]", "headGain", (600 - now) / 600.0);
};

GeminiGMXHid.changedBoothVolume = function(prev, now) {
	engine.setParameter("[Master]", "booth_gain", (600 - now) / 600.0);
};

GeminiGMXHid.changedCueMix = function(prev, now) {
	engine.setParameter("[Master]", "headMix", (600 - now) / 600.0);
};

GeminiGMXHid.changedCrossFade = function(prev, now) {
	engine.setParameter("[Master]", "crossfader", (800 - now) / 800.0);
};

GeminiGMXHid.changedVolume = function(prev, now, ud) {
	engine.setParameter("[Channel" + ud + "]", "volume", now / 800.0);
};

GeminiGMXHid.changedCueMaster = function(prev, now) {
	//TODO
	// 0 = cue, 64 = master
};

GeminiGMXHid.changedBrowse = function(prev, now) {
	if (prev === null) {
		return;
	}

	// 0 to 29 (then wraps around)
	var delta = now - prev;
	if (delta < -10) {
		delta = (now + 29 + 1) - prev;
	} else if (delta > 10) {
		delta = (now - 29 - 1) - prev;
	}
	engine.setParameter("[Library]", "MoveVertical", delta);
};

GeminiGMXHid.changedRate = function(prev, now, ud) {
	engine.setParameter("[Channel" + ud +"]", "rate", now / 800.0);
};

GeminiGMXHid.changedJog = function(prev, now, ud) {
	if (prev === null) {
		return;
	}

	// 0 to 179 (then wraps around)
	var delta = now - prev;
	if (delta < -140) {
		delta = (now + 179 + 1) - prev;
	} else if (delta > 140) {
		delta = (now - 179 - 1) - prev;
	}

	if (GeminiGMXHid.IsSearching) {
		delta *= 8;
	}

	if (engine.isScratching(ud)) {
		engine.scratchTick(ud, delta);
	} else {
		engine.setValue("[Channel" + ud + "]", "jog", delta);
	}
};

GeminiGMXHid.changedGain = function(prev, now, ud) {
	engine.setValue("[Channel" + ud + "]", "pregain", script.absoluteNonLin(now, 0, 1.0, 4.0, 0, 600));
};

GeminiGMXHid.changedHighs = function(prev, now, ud) {
	engine.setValue("[EqualizerRack1_[Channel" + ud + "]_Effect1]", "parameter3", script.absoluteNonLin(now, 0, 1.0, 4.0, 0, 600));
};

GeminiGMXHid.changedMids = function(prev, now, ud) {
	engine.setValue("[EqualizerRack1_[Channel" + ud + "]_Effect1]", "parameter2", script.absoluteNonLin(now, 0, 1.0, 4.0, 0, 600));
};

GeminiGMXHid.changedLows = function(prev, now, ud) {
	engine.setValue("[EqualizerRack1_[Channel" + ud + "]_Effect1]", "parameter1", script.absoluteNonLin(now, 0, 1.0, 4.0, 0, 600));
};

GeminiGMXHid.changedFilter = function(prev, now, ud) {
	engine.setValue("[QuickEffectRack1_[Channel" + ud + "]]", "super1", now / 600.0);
};
