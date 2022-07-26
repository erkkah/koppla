# Koppla

Create electronic schematics from readable code.

## Example

```
# An example schematic

<in> - [R1:10k] - |4.7uF| - <gnd>
[R1] - <out>
```

![](example.svg)

## Syntax

### Components


| Part | Designator | Code |
| --- | --- | --- |
| Resistor | R | `- [] -` |
| Capacitor | C | `- \|\| -` |
| Polarized Capacitor | C | `- \|] -` |
| Inductor | L | `- $$ -` |
| Diode | D | `- >\| -` |
| Zener Diode | D | `- >/ - ` |
| Transistor | Q | `- () -` |
| IC | U | `- // -` |
| *Generic* | - | `- ** -` |

The component definition is written between the opening and closing character, for resistors '[' and ']'.
Empty definitions are valid. Components will be given default identities (R1, R2, et.c.) if none is specified.

#### Component definition

A full component definition has four parts:

* Component ID
* Value
* Symbol
* Description

For a resistor:
```
[R12: 47k !symbol "Description"]
```

All parts are optional. Simply specifying a value is fine:

```
|22nF|
```

If no symbol is specified, the default symbol for the component type is used.
Component ID and value must be separated by a colon if both are specified.

### Ports

There are four kinds of ports:

| Kind | code |
| --- | --- |
| input | `<in>` |
| output | `<out>` |
| supply voltage | `<v>` |
| ground | `<gnd>` |

Multiple ports of a certain kind are supported by adding a specifier, separated by a colon:

```
<v:+22v> - [10ohm "10w"] - <out:supply>
```

### Connections

Connections are made by connecting components with wires. Wires must be delimited by spaces.
Wires are connected to the specified terminal of each component.

In this example, the resistor is connected to the collector of the transistor:

```
[R1] - c(Q1)
```

If no terminal is specified, terminals are chosen based on which side of the component the wire connects to.
A wire on the left hand side connects to the first terminal, and a wire on the right hand side connects to the second.

All ports have one terminal.

> The available terminals are defined by the symbol. A NPN transistor will have the terminals 'c', 'b' and 'e' while a MOSFET will have terminals 'd', 'g' and 's' as expected.

### Comments

Single-line comments use the `#` symbol, and multi-line comments are delimited by `#*` and `*#`.

```
# This is a single line comment

- [ R1 ] - # And so is this

#*
This whole block is a comment.
- [ R1 ] -
*#
```

### Component definitions

## Symbols

## TODO

* Add enough components to create opamp filter
* Better error handling + reporting
* Add option to render ohm symbol
* Make it a syntax error to use the wrong designator / symbol mix
* Make diodes and polarized caps work in both directions, flipping terminals as needed
* Add "h-flip" after rotation as possible optimization step
* Make component label / value drawing optional
* Optimize svg output

https://en.wikipedia.org/wiki/Reference_designator#Other_designators
