using System.ComponentModel.DataAnnotations;

namespace Module.DTOs;

public class CreateUserDto
{
    [Required]
    [StringLength(50, MinimumLength = 3)]
    public string Username { get; set; } = string.Empty;

    [Required]
    [EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required]
    [StringLength(100, MinimumLength = 6)]
    public string Password { get; set; } = string.Empty;

    public List<string> Roles { get; set; } = new();
    
    public int? LinkedModuleId { get; set; }
    public int? LinkedRecordId { get; set; }
}
