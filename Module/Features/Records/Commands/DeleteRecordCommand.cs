using MediatR;
using Microsoft.EntityFrameworkCore;
using Module.Common;
using Module.Data;
using Module.Services;

namespace Module.Features.Records.Commands;

public record DeleteRecordCommand(int ModuleId, int RecordId) : ICommand;

public class DeleteRecordHandler : IRequestHandler<DeleteRecordCommand>
{
    private readonly AppDbContext _context;
    private readonly IRelationService _relationService;

    public DeleteRecordHandler(AppDbContext context, IRelationService relationService)
    {
        _context = context;
        _relationService = relationService;
    }

    public async Task Handle(DeleteRecordCommand request, CancellationToken cancellationToken)
    {
        var record = await _context.ModuleRecords
            .FirstOrDefaultAsync(r => r.Id == request.RecordId && r.ModuleId == request.ModuleId, cancellationToken);

        if (record == null)
        {
            throw new KeyNotFoundException($"Record with ID {request.RecordId} not found in module {request.ModuleId}.");
        }

        _context.ModuleRecords.Remove(record);
        await _context.SaveChangesAsync(cancellationToken);

        // Delete relations for source
        var module = await _context.Modules.FindAsync(new object[] { request.ModuleId }, cancellationToken);
        if (module != null)
        {
            await _relationService.DeleteRelationsForSource(module.Name, record.Id);
        }
    }
}
