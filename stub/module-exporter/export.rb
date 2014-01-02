#!/usr/bin/env ruby

# Customize this name
module_name = "Org"

module JSExporter
  class Sorter
    def initialize()
    end

    def init_node_statuses(graph)
      @statuses = {}
      graph.keys.each { |node|
        @statuses[node] = :undone;
      }
    end

    def sort(graph)
      init_node_statuses(graph)

      @sorted = []
      graph.keys.each { |node|
        visit_node_children(graph, node)
      }
      @sorted
    end

    def visit_node_children(graph, node)
      is_done_node = @statuses[node] == :done
      children_node = graph[node] or return
      @statuses[node] = :visiting
      children_node.each { |child_node|
        if @statuses[child_node] == :visiting
          raise "Cyclic reference found for " + child_node
        end
        visit_node_children(graph, child_node)
      }

      @sorted.push(node) unless is_done_node
      @statuses[node] = :done
    end
  end

  class Exporter
    def initialize(paths)
      @paths        = paths
      @name2path    = Hash[paths.map { |path| [normalize_path(path), path] }]
      @contents     = Hash[paths.map { |path| [path, IO.read(path)] }]
      @graph        = build_graph(paths)
      @sorted_names = Sorter.new.sort(@graph)
    end

    def build_graph(paths)
      graph = {}
      paths.each { |path|
        name = normalize_path(path)
        graph[name] = get_depends(@contents[path])
      }
      graph
    end

    DependRegexp = /(?:^|^.*[^a-zA-Z0-9])require\((.*?)\).*$/
    def get_depends(content)
      content.scan(DependRegexp).map { |match|
        path = match[0].sub(/^("|')/, "").sub(/("|')$/, "")
        normalize_path(path)
      }
    end

    def remove_depend_notation(content)
      content.gsub(DependRegexp, "// \\0")
    end

    def remove_depend_notations
      @contents.each { |key, content|
        @contents[key] = remove_depend_notation(content)
      }
    end

    def sorted_paths
      @sorted_names.map { |name| @name2path[name] }
    end

    def sorted_contents
      sorted_paths.map { |path| @contents[path] }
    end

    def normalize_path(path)
      File::basename(path)
    end
  end
end

exporter = JSExporter::Exporter.new(ARGV)
exporter.remove_depend_notations
sorted_contents = exporter.sorted_contents

puts <<EOS
var #{module_name} = (function () {
  var exports = {};

EOS

puts sorted_contents.map { |content|
  # Add indentation
  content.split("\n").map { |line|
    if line == ""
      line
    else
      "  " + line
    end
  }.join("\n") + "\n"
}.join("\n")

puts <<EOS

  return exports;
})();
EOS

$stderr.puts(exporter.sorted_paths.join("\n"))
