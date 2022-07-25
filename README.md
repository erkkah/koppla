# Koppla

Code electronic schematics using a simple syntax.

## Example

```
# An example schematic

*IN* - [R1:10k] - |4.7uF| - *gnd*
[R1] - *out*
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

*Note that unconnected components are coded without the wires shown here.*

The component definition is written between the opening and closing character, for resistors '[' and ']'. An empty definition is valid. Components will be given default identities (R1, R2, et.c.) if none is specified.

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

All parts are optional, simply specifying a value is fine:

```
|22nF|
```

If no symbol is specified, the default symbol for the component type is used.

### Connections

Connections are made by connecting components with wires. Wires must be delimited by spaces.
Wires are connected to the specified terminal of each component.

In this example, the resistor is connected to the collector of the transistor:

```
[R1] - c(Q1)
```

If no terminal is specified, terminals are chosen based on which side of the component the wire connects to.
A wire on the left hand side connects to the first terminal, and a wire on the right hand side connects to the second.

> The available terminals are defined by the symbol. A NPN transistor will have the terminals 'c', 'b' and 'e' while a MOSFET will have terminals 'd', 'g' and 's' as expected.

### Comments

### Component definitions

## Symbols

## TODO

* Better error handling + reporting
* Make it a syntax error to use the wrong designator / symbol mix
* Make diodes and polarized caps work in both directions, flipping terminals as needed
* Add enough components to create astable flip-flop, opamp filter
* Rotation-lock inputs, outputs, power lines
* Add "h-flip" after rotation as possible optimization step
* Make component label / value drawing optional
* Draw junctions
* Pick and embed font
* Optimize svg output
* Scale symbols based on terminal width

https://en.wikipedia.org/wiki/Reference_designator#Other_designators
