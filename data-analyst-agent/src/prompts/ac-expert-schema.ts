// Schema for the response format
export const responseSchema = {
    type: 'object',
    properties: {
        card: {
            type: 'object',
            description: 'The Adaptive Card JSON to create',
            properties: {
                type: { type: 'string', enum: ['AdaptiveCard'] },
                version: { type: 'string', enum: ['1.6'] },
                body: {
                    type: 'array',
                    items: {
                        "$ref": "#/$defs/CardElementArray"
                    },
                },
            },
            required: ['type', 'version', 'body'],
            additionalProperties: false
        },
        name: { $ref: '#/$defs/name' },
    },
    additionalProperties: false,
    required: ['card', 'name'],
    $defs: {
        name: { type: 'string' },
        CardElementArray: {
            anyOf: [
                { "$ref": "#/$defs/TextBlock" },
                { "$ref": "#/$defs/Chart.VerticalBar" },
                { "$ref": "#/$defs/Chart.HorizontalBar" },
                { "$ref": "#/$defs/Chart.Line" }
            ],
        },
        TextBlock: {
            type: 'object',
            properties: {
                type: { type: 'string', enum: ['TextBlock'] },
                separator: {
                    type: "boolean"
                },
                height: {
                    "$ref": "#/$defs/5.height"
                },
                text: { type: 'string' },
                horizontalAlignment: {
                    "$ref": "#/$defs/6.horizontalAlignment"
                },
                spacing: {
                    "$ref": "#/$defs/7.spacing"
                },
                targetWidth: {
                    "$ref": "#/$defs/8.targetWidth"
                },
                size: {
                    "$ref": "#/$defs/19.size"
                },
                weight: {
                    "$ref": "#/$defs/20.weight"
                },
                color: {
                    "$ref": "#/$defs/21.color"
                },
                isSubtle: {
                    type: "boolean"
                },
                fontType: {
                    "$ref": "#/$defs/22.fontType"
                },
                wrap: {
                    type: "boolean"
                },
                maxLines: {
                    type: "number"
                },
                style: {
                    "$ref": "#/$defs/23.style"
                },
            },
            required: [
                "text", "type"
            ],
            additionalProperties: false
        },
        "Chart.VerticalBar": {
            "type": "object",
            "properties": {
                type: { type: 'string', enum: ['Chart.VerticalBar'] },
                separator: { type: 'boolean' },
                height: {
                    "$ref": "#/$defs/5.height"
                },
                horizontalAlignment: {
                    "$ref": "#/$defs/6.horizontalAlignment"
                },
                spacing: {
                    "$ref": "#/$defs/7.spacing"
                },
                targetWidth: {
                    "$ref": "#/$defs/8.targetWidth"
                },
                title: { type: 'string' },
                colorSet: { type: 'string' },
                xAxisTitle: { type: 'string' },
                yAxisTitle: { type: 'string' },
                data: {
                    type: 'array',
                    items: {
                        "$ref": "#/$defs/VerticalBarChartDataValue"
                    }
                },
                color: {
                    "$ref": "#/$defs/46.color"
                },
                showBarValues: { type: 'boolean' },
                gridArea: { type: 'string' },
            },
            required: [
                "type", "title", "xAxisTitle", "yAxisTitle", "data", "color"
            ],
            additionalProperties: false
        },
        VerticalBarChartDataValue: {
            type: "object",
            properties: {
                x: {
                    $ref: "#/$defs/47.x"
                },
                y: {
                    type: "number"
                },
                color: {
                    $ref: "#/$defs/46.color"
                }
            },
            required: [
                "x", "y", "color"
            ],
            additionalProperties: false
        },
        "Chart.HorizontalBar": {
            type: "object",
            properties: {
                type: { type: 'string', enum: ['Chart.HorizontalBar'] },
                separator: { type: 'boolean' },
                height: {
                    "$ref": "#/$defs/5.height"
                },
                horizontalAlignment: {
                    "$ref": "#/$defs/6.horizontalAlignment"
                },
                spacing: {
                    "$ref": "#/$defs/7.spacing"
                },
                targetWidth: {
                    "$ref": "#/$defs/8.targetWidth"
                },
                title: { type: 'string' },
                colorSet: { type: 'string' },
                xAxisTitle: { type: 'string' },
                yAxisTitle: { type: 'string' },
                color: {
                    "$ref": "#/$defs/46.color"
                },
                data: {
                    type: "array",
                    items: {
                        "$ref": "#/$defs/HorizontalBarChartDataValue"
                    }
                },
                displayMode: {
                    "$ref": "#/$defs/48.displayMode"
                },
                "grid.area": { type: 'string' },
            },
            required: [
                "type", "title", "xAxisTitle", "yAxisTitle", "data", "color"
            ],
            additionalProperties: false
        },
        HorizontalBarChartDataValue: {
            type: "object",
            properties: {
                x: {
                    type: "string"
                },
                y: {
                    type: "number"
                },
                color: {
                    "$ref": "#/$defs/46.color"
                }
            },
            additionalProperties: false
        },
        "Chart.Line": {
            "type": "object",
            "properties": {
                type: { type: 'string', enum: ['Chart.Line'] },
                separator: { type: 'boolean' },
                height: {
                    "$ref": "#/$defs/5.height"
                },
                horizontalAlignment: {
                    "$ref": "#/$defs/6.horizontalAlignment"
                },
                spacing: {
                    "$ref": "#/$defs/7.spacing"
                },
                targetWidth: {
                    "$ref": "#/$defs/8.targetWidth"
                },
                title: { type: 'string' },
                colorSet: { type: 'string' },
                xAxisTitle: { type: 'string' },
                yAxisTitle: { type: 'string' },
                color: {
                    "$ref": "#/$defs/46.color"
                },
                data: {
                    type: "array",
                    items: {
                        "$ref": "#/$defs/LineChartData"
                    }
                },
                "grid.area": {
                    "type": "string"
                },
            },
            "required": [
                "type", "title", "xAxisTitle", "yAxisTitle", "data", "color"
            ],
            "additionalProperties": false
        },
        "LineChartData": {
            "type": "object",
            "properties": {
                "legend": {
                    "type": "string"
                },
                "values": {
                    "type": "array",
                    "items": {
                        "$ref": "#/$defs/LineChartValue"
                    }
                },
                "color": {
                    "$ref": "#/$defs/46.color"
                }
            },
            "additionalProperties": true
        },
        "LineChartValue": {
            "type": "object",
            "properties": {
                "x": {
                    "$ref": "#/$defs/49.x"
                },
                "y": {
                    "type": "number"
                }
            },
            "additionalProperties": true
        },
        "Chart.Pie": {
            "type": "object",
            "properties": {
                "type": { type: 'string', enum: ['Chart.Pie'] },
                "isVisible": { type: 'boolean' },
                "separator": { type: 'boolean' },
                "height": {
                    "$ref": "#/$defs/5.height"
                },
                "horizontalAlignment": {
                    "$ref": "#/$defs/6.horizontalAlignment"
                },
                "spacing": {
                    "$ref": "#/$defs/7.spacing"
                },
                "targetWidth": {
                    "$ref": "#/$defs/8.targetWidth"
                },
                "title": {
                    "type": "string"
                },
                "colorSet": {
                    "type": "string"
                },
                "data": {
                    "type": "array",
                    "items": {
                        "$ref": "#/$defs/DonutChartData"
                    }
                },
                "grid.area": {
                    "type": "string"
                }
            },
            "required": [
                "type", "title", "data", "color"
            ],
            "additionalProperties": false
        },
        "DonutChartData": {
            "type": "object",
            "properties": {
                "legend": {
                    "type": "string"
                },
                "value": {
                    "type": "number"
                },
                "color": {
                    "$ref": "#/$defs/46.color"
                }
            },
            required: [
                "legend", "value", "color"
            ],
            "additionalProperties": false
        },
        "5.height": {
            type: "string",
            enum: ["auto", "stretch"],
        },
        "6.horizontalAlignment": {
            type: "string",
            enum: ["LEFT", "CENTER", "RIGHT"]
        },
        "7.spacing": {
            type: "string",
            enum: ["NONE", "EXTRASMALL", "SMALL", "DEFAULT", "MEDIUM", "LARGE", "EXTRALARGE", "PADDING"]
        },
        "8.targetWidth": {
            type: "string",
            enum: ["VERYNARROW", "NARROW", "STANDARD", "WIDE", 
                  "ATLEAST:VERYNARROW", "ATMOST:VERYNARROW",
                  "ATLEAST:NARROW", "ATMOST:NARROW", 
                  "ATLEAST:STANDARD", "ATMOST:STANDARD",
                  "ATLEAST:WIDE", "ATMOST:WIDE"]
        },
        "19.size": {
            type: "string",
            enum: ["SMALL", "DEFAULT", "MEDIUM", "LARGE", "EXTRALARGE"]
        },
        "20.weight": {
            type: "string",
            enum: ["LIGHTER", "DEFAULT", "BOLDER"]
        },
        "21.color": {
            type: "string",
            enum: ["DEFAULT", "DARK", "LIGHT", "ACCENT", "GOOD", "WARNING", "ATTENTION"]
        },
        "22.fontType": {
            type: "string",
            enum: ["DEFAULT", "MONOSPACE"]
        },
        "23.style": {
            type: "string",
            enum: ["DEFAULT", "COLUMNHEADER", "HEADING"]
        },
        "47.x": {
            "oneOf": [
                {
                    "type": "string"
                },
                {
                    "type": "number"
                }
            ]
        },
        "46.color": {
            "type": "string",
            enum: [
                "GOOD", "WARNING", "ATTENTION", "NEUTRAL",
                "CATEGORICALRED", "CATEGORICALPURPLE", "CATEGORICALLAVENDER", "CATEGORICALBLUE",
                "CATEGORICALLIGHTBLUE", "CATEGORICALTEAL", "CATEGORICALGREEN", "CATEGORICALLIME",
                "CATEGORICALMARIGOLD",
                "SEQUENTIAL1", "SEQUENTIAL2", "SEQUENTIAL3", "SEQUENTIAL4",
                "SEQUENTIAL5", "SEQUENTIAL6", "SEQUENTIAL7", "SEQUENTIAL8",
                "DIVERGINGBLUE", "DIVERGINGLIGHTBLUE", "DIVERGINGCYAN", "DIVERGINGTEAL",
                "DIVERGINGYELLOW", "DIVERGINGPEACH", "DIVERGINGLIGHTRED", "DIVERGINGRED",
                "DIVERGINGMAROON", "DIVERGINGGRAY"
            ]
        },
        "48.displayMode": {
            type: "string",
            enum: ["AbsoluteWithAxis", "RelativeWithAxis", "RelativeWithoutAxis"]
        },
        "49.x": {
            "oneOf": [
                {
                    "type": "number",
                },
                {
                    "type": "string",
                    "description": "This should be a date string in a valid format like yyyy-MM-dd"
                }
            ]
        }
    }
};