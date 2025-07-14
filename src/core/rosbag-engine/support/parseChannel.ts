import type { MessageDefinition, MessageDefinitionField } from '@foxglove/message-definition'
import type { IDLMessageDefinition } from '@foxglove/omgidl-parser'
import { parseIDL } from '@foxglove/omgidl-parser'
import { MessageReader as OmgidlMessageReader } from '@foxglove/omgidl-serialization'
import { parseRos2idl } from '@foxglove/ros2idl-parser'
import { parse as parseMessageDefinition } from '@foxglove/rosmsg'
import { MessageReader as ROS2MessageReader } from '@foxglove/rosmsg2-serialization'

/** A map of schema name to the schema message definition */
export type MessageDefinitionMap = Map<string, MessageDefinition>

interface Channel {
  messageEncoding: string
  schema: { name: string, encoding: string, data: Uint8Array } | undefined
}

export interface ParsedChannel {
  deserialize: (data: ArrayBufferView) => unknown
  datatypes: MessageDefinitionMap
}

const KNOWN_EMPTY_SCHEMA_NAMES = ['std_msgs/Empty', 'std_msgs/msg/Empty']

function parsedDefinitionsToDatatypes(
  parsedDefinitions: MessageDefinition[],
  rootName?: string,
): MessageDefinitionMap {
  const datatypes: MessageDefinitionMap = new Map()
  parsedDefinitions.forEach(({ name, definitions }, index) => {
    if (rootName != undefined && index === 0) {
      datatypes.set(rootName, { name: rootName, definitions })
    }
    else if (name != undefined) {
      datatypes.set(name, { name, definitions })
    }
  })
  return datatypes
}

function parseIDLDefinitionsToDatatypes(
  parsedDefinitions: IDLMessageDefinition[],
  rootName?: string,
) {
  //  The only IDL definition non-conformant-to-MessageDefinition is unions
  const convertUnionToMessageDefinition = (definition: IDLMessageDefinition): MessageDefinition => {
    if (definition.aggregatedKind === 'union') {
      const innerDefs: MessageDefinitionField[] = definition.cases.map(caseDefinition => ({
        ...caseDefinition.type,
        predicates: caseDefinition.predicates,
      }))

      if (definition.defaultCase != undefined) {
        innerDefs.push(definition.defaultCase)
      }
      const { name } = definition
      return {
        name,
        definitions: innerDefs,
      }
    }
    return definition
  }

  const standardDefs: MessageDefinition[] = parsedDefinitions.map(convertUnionToMessageDefinition)
  return parsedDefinitionsToDatatypes(standardDefs, rootName)
}

export function parseChannel(
  channel: Channel,
  options?: { allowEmptySchema: boolean },
): ParsedChannel {
  // For ROS schemas, we expect the schema to be non-empty unless the
  // schema name is one of the well-known empty schema names.
  if (
    options?.allowEmptySchema !== true
    && ['ros1msg', 'ros2msg', 'ros2idl'].includes(channel.schema?.encoding ?? '')
    && channel.schema?.data.length === 0
    && !KNOWN_EMPTY_SCHEMA_NAMES.includes(channel.schema.name)
  ) {
    throw new Error(`Schema for ${channel.schema.name} is empty`)
  }

  if (channel.messageEncoding === 'cdr') {
    if (
      channel.schema?.encoding !== 'ros2msg'
      && channel.schema?.encoding !== 'ros2idl'
      && channel.schema?.encoding !== 'omgidl'
    ) {
      throw new Error(
        `Message encoding ${channel.messageEncoding} with ${
          channel.schema == undefined
            ? 'no encoding'
            : `schema encoding '${channel.schema.encoding}'`
        } is not supported (expected "ros2msg" or "ros2idl")`,
      )
    }
    const schema = new TextDecoder().decode(channel.schema.data)
    if (channel.schema.encoding === 'omgidl') {
      const parsedDefinitions = parseIDL(schema)
      const reader = new OmgidlMessageReader(channel.schema.name, parsedDefinitions)
      const datatypes = parseIDLDefinitionsToDatatypes(parsedDefinitions)
      return {
        datatypes,
        deserialize: data => reader.readMessage(data),
      }
    }
    else {
      const isIdl = channel.schema.encoding === 'ros2idl'

      const parsedDefinitions = isIdl
        ? parseRos2idl(schema)
        : parseMessageDefinition(schema, { ros2: true })

      const reader = new ROS2MessageReader(parsedDefinitions)

      return {
        datatypes: parsedDefinitionsToDatatypes(parsedDefinitions, channel.schema.name),
        deserialize: data => reader.readMessage(data),
      }
    }
  }

  throw new Error(`Unsupported encoding ${channel.messageEncoding}`)
}
