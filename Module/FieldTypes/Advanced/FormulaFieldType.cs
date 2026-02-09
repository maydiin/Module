using Module.Entities;
using System.Text.Json;

namespace Module.FieldTypes.Advanced;

public class FormulaFieldType : IFieldType
{
    public string Type => "formula";

    public object? Parse(object? value)
    {
        return value; // Calculated, so input doesn't matter much
    }

    public List<string> Validate(ModuleField field, object? value)
    {
        return new List<string>(); // Always valid, as it's computed system-side
    }

    public object? Compute(ModuleField field, object? recordData)
    {
        var formula = field.Options; 
        if (string.IsNullOrEmpty(formula))
        {
            return null;
        }


        if (recordData is Dictionary<string, object> data)
        {
            // Parse formula by finding operator between {field1} and {field2}
            // Example: "{price} * {quantity}" or "{total} - {discount}"
            
            var operators = new[] { '+', '-', '*', '/' };
            
            foreach (var op in operators)
            {
                // Find operator position (outside of curly braces)
                var opIndex = FindOperatorIndex(formula, op);
                if (opIndex == -1) continue;
                
                
                var leftPart = formula.Substring(0, opIndex).Trim();
                var rightPart = formula.Substring(opIndex + 1).Trim();
                
                var key1 = leftPart.Trim('{', '}');
                var key2 = rightPart.Trim('{', '}');
                
                
                var val1 = GetValue(data, key1);
                var val2 = GetValue(data, key2);
                
                
                var result = op switch
                {
                    '+' => val1 + val2,
                    '-' => val1 - val2,
                    '*' => val1 * val2,
                    '/' => val2 == 0 ? (decimal?)null : val1 / val2,
                    _ => (decimal?)null
                };
                
                return result;
            }
        }
        
        return null;
    }
    
    private int FindOperatorIndex(string formula, char op)
    {
        var depth = 0;
        for (int i = 0; i < formula.Length; i++)
        {
            if (formula[i] == '{') depth++;
            else if (formula[i] == '}') depth--;
            else if (formula[i] == op && depth == 0)
            {
                return i;
            }
        }
        return -1;
    }

    private decimal GetValue(Dictionary<string, object> data, string key)
    {
        if (data.TryGetValue(key, out var obj) && decimal.TryParse(obj?.ToString(), out var val))
        {
            return val;
        }
        return 0; // Return 0 if creating missing, so "Price * null" becomes "Price * 0" = 0
    }
}
