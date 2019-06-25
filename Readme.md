# Gemini GMX Mixxx Mapping
A work-in-progress [Mixxx](https://www.mixxx.org/) mapping for the [Gemini GMX](https://geminisound.com/products/gmx).

Its current state is a working one - it's good enough to be used in production.

There are 2 mappings in this repository:

* One for the controller's MIDI interface
* One for the controller's HID interface

The HID interface can do a lot more than the MIDI interface, so I suggest only using that one.

## Things that don't work yet
The MIDI interface has a lot of things that don't work, but the HID interface supports most things. The following features I have not implemented yet into the HID script:

* Hotcues
* Loops
* Pitch percentage value on the LCD display
* Range value on the LCD display
* Loop indicators on the LCD display
* Displaying loaded track information (API for this is not available in the current version of Mixxx)
